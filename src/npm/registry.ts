/**
 * Thin wrapper around the npm registry API.
 * Only fetches what we need — no unnecessary data.
 */

import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetch-with-retry.js';

const REGISTRY = 'https://registry.npmjs.org';

// ---------------------------------------------------------------------------
// TypeScript types (source of truth for callers)
// ---------------------------------------------------------------------------

export interface VersionManifest {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** lifecycle scripts (preinstall, install, postinstall, etc.) */
  scripts?: Record<string, string>;
  dist: {
    tarball: string;
    shasum: string;
  };
}

export interface PackageMetadata {
  name: string;
  /** version string → manifest */
  versions: Record<string, VersionManifest>;
  /** dist-tags, e.g. { latest: "2.5.0" } */
  'dist-tags': Record<string, string>;
}

// ---------------------------------------------------------------------------
// Zod schemas — validate external data shape before use
// In Zod v4, z.record() requires both key and value schemas.
// ---------------------------------------------------------------------------

const versionManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  dependencies: z.record(z.string(), z.string()).optional(),
  devDependencies: z.record(z.string(), z.string()).optional(),
  scripts: z.record(z.string(), z.string()).optional(),
  dist: z.object({
    tarball: z.string().url(),
    shasum: z.string(),
  }),
});

const packageMetadataSchema = z.object({
  name: z.string(),
  versions: z.record(z.string(), versionManifestSchema),
  'dist-tags': z.record(z.string(), z.string()),
});

const abbreviatedMetadataSchema = z.object({
  'dist-tags': z.record(z.string(), z.string()).optional(),
});

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Build a registry URL using the URL constructor so that user-supplied package
 * names never inject path components, query strings, or authority segments.
 * Validates that the result stays within the expected registry origin.
 */
function registryUrl(name: string): string {
  const url = new URL(encodeURIComponent(name), REGISTRY + '/');
  if (url.origin !== REGISTRY) {
    throw new Error(`package name resolves outside registry origin: ${url.origin}`);
  }
  return url.toString();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch the full metadata document for a package. */
export async function fetchPackageMetadata(name: string): Promise<PackageMetadata> {
  const res = await fetchWithRetry(registryUrl(name));
  if (!res.ok) {
    throw new Error(`registry fetch failed for ${name}: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  return packageMetadataSchema.parse(raw) as PackageMetadata;
}

/**
 * Return only the latest published version string.
 * Uses the abbreviated metadata endpoint — much smaller payload than full metadata.
 */
export async function fetchLatestVersion(name: string): Promise<string> {
  const res = await fetchWithRetry(registryUrl(name), {
    headers: { 'Accept': 'application/vnd.npm.install-v1+json' },
  });
  if (!res.ok) {
    throw new Error(`registry fetch failed for ${name}: ${res.status} ${res.statusText}`);
  }
  const raw = await res.json();
  const data = abbreviatedMetadataSchema.parse(raw);
  const latest = data['dist-tags']?.['latest'];
  if (!latest) throw new Error(`no latest dist-tag for ${name}`);
  return latest;
}

/** Return the manifest for a specific version. */
export function getVersionManifest(
  meta: PackageMetadata,
  version: string,
): VersionManifest | null {
  return meta.versions[version] ?? null;
}
