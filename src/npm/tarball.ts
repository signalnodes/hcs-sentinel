/**
 * Downloads an npm tarball and scans its source files for risky patterns.
 * Files are streamed through memory — nothing is written to disk.
 */

import { createGunzip } from 'node:zlib';
import { Readable } from 'node:stream';
import * as tar from 'tar';
import type { Signal } from '../types/index.js';
import { fetchWithRetry } from '../utils/fetch-with-retry.js';

/** Patterns to detect in source files */
const RISKY_PATTERNS: Array<{ name: string; re: RegExp }> = [
  { name: 'child_process', re: /require\s*\(\s*['"]child_process['"]\s*\)|from\s+['"]child_process['"]/ },
  { name: 'process.env',   re: /process\.env/ },
  { name: 'fs',            re: /require\s*\(\s*['"](?:fs|node:fs)['"]\s*\)|from\s+['"](?:fs|node:fs)['"]/ },
  { name: 'crypto',        re: /require\s*\(\s*['"](?:crypto|node:crypto)['"]\s*\)|from\s+['"](?:crypto|node:crypto)['"]/ },
];

/** Only scan these extensions — skip lockfiles, images, etc. */
const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.jsx', '.tsx']);

/** Expected origin for all tarball URLs — rejects SSRF attempts */
const EXPECTED_TARBALL_ORIGIN = 'https://registry.npmjs.org';

/** Max bytes buffered per source file before skipping the rest of that entry */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Max total bytes buffered across all entries — guards against tar bombs */
const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Validate that a tarball URL comes from the expected registry origin.
 * Prevents SSRF via a crafted registry manifest.
 */
function assertTarballOrigin(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid tarball URL: ${url}`);
  }
  if (parsed.origin !== EXPECTED_TARBALL_ORIGIN) {
    throw new Error(
      `tarball URL origin "${parsed.origin}" is not the expected registry "${EXPECTED_TARBALL_ORIGIN}"`,
    );
  }
}

/** Returns one signal per distinct risky pattern detected (no duplicates). */
export async function scanTarball(tarballUrl: string): Promise<Signal[]> {
  // Guard: reject URLs that don't originate from the npm registry
  assertTarballOrigin(tarballUrl);

  // 60s timeout for tarball downloads — large packages can be slow
  const res = await fetchWithRetry(tarballUrl, undefined, 60_000);
  if (!res.ok || !res.body) {
    throw new Error(`tarball fetch failed: ${res.status} ${res.statusText}`);
  }

  const found = new Set<string>();
  let totalBytesBuffered = 0;

  // Convert Web ReadableStream → Node Readable
  const nodeStream = Readable.fromWeb(res.body as import('stream/web').ReadableStream<Uint8Array>);

  await new Promise<void>((resolve, reject) => {
    const gunzip = createGunzip();
    const parser = new tar.Parser();

    parser.on('entry', (entry: tar.ReadEntry) => {
      const path = entry.path;
      const ext = path.slice(path.lastIndexOf('.'));

      if (!SCAN_EXTENSIONS.has(ext)) {
        entry.resume();
        return;
      }

      // Abort the whole scan if we've already buffered too much total data
      if (totalBytesBuffered >= MAX_TOTAL_BYTES) {
        entry.resume();
        return;
      }

      const buffers: Buffer[] = [];
      let fileBytesBuffered = 0;
      let fileTruncated = false;

      entry.on('data', (chunk: Buffer) => {
        if (fileTruncated) return;

        const remaining = Math.min(
          MAX_FILE_BYTES - fileBytesBuffered,
          MAX_TOTAL_BYTES - totalBytesBuffered,
        );

        if (chunk.length <= remaining) {
          buffers.push(chunk);
          fileBytesBuffered += chunk.length;
          totalBytesBuffered += chunk.length;
        } else {
          // Take what we can, then stop buffering this entry
          if (remaining > 0) {
            buffers.push(chunk.subarray(0, remaining));
            fileBytesBuffered += remaining;
            totalBytesBuffered += remaining;
          }
          fileTruncated = true;
        }
      });

      entry.on('end', () => {
        const content = Buffer.concat(buffers).toString('utf8');
        for (const { name, re } of RISKY_PATTERNS) {
          if (re.test(content)) found.add(name);
        }
      });

      entry.on('error', reject);
    });

    parser.on('finish', resolve);
    parser.on('error', reject);
    gunzip.on('error', reject);

    nodeStream.pipe(gunzip).pipe(parser);
  });

  return [...found].map((name): Signal => ({
    type: `risky_api:${name}`,
    detail: `package source uses ${name}`,
    severity: name === 'child_process' ? 'high' : 'warning',
  }));
}
