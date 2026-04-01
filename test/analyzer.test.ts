import { describe, it, expect, vi } from 'vitest';
import type { VersionManifest } from '../src/npm/registry.js';

// Mock the tarball scanner — we don't want real network calls in unit tests
vi.mock('../src/npm/tarball.js', () => ({
  scanTarball: vi.fn().mockResolvedValue([]),
}));

import { analyzeRelease } from '../src/core/analyzer.js';
import { scanTarball } from '../src/npm/tarball.js';

function makeManifest(overrides: Partial<VersionManifest> = {}): VersionManifest {
  return {
    name: '@hashgraph/sdk',
    version: '2.50.0',
    dependencies: {},
    devDependencies: {},
    scripts: {},
    dist: { tarball: 'https://example.com/fake.tgz', shasum: 'abc' },
    ...overrides,
  };
}

describe('analyzeRelease', () => {
  it('returns info severity for identical versions', async () => {
    const manifest = makeManifest();
    const finding = await analyzeRelease(manifest, manifest);
    expect(finding.severity).toBe('info');
    expect(finding.signals).toHaveLength(0);
  });

  it('detects new dependencies as warning', async () => {
    const prev = makeManifest({ dependencies: { foo: '1.0.0' } });
    const next = makeManifest({
      version: '2.51.0',
      dependencies: { foo: '1.0.0', bar: '2.0.0' },
    });
    const finding = await analyzeRelease(next, prev);
    expect(finding.severity).toBe('warning');
    expect(finding.signals.some(s => s.type === 'new_dependency')).toBe(true);
  });

  it('detects removed dependencies as info', async () => {
    const prev = makeManifest({ dependencies: { foo: '1.0.0', bar: '2.0.0' } });
    const next = makeManifest({
      version: '2.51.0',
      dependencies: { foo: '1.0.0' },
    });
    const finding = await analyzeRelease(next, prev);
    expect(finding.signals.some(s => s.type === 'removed_dependency')).toBe(true);
  });

  it('marks deps as baseline on first scan', async () => {
    const next = makeManifest({
      dependencies: { foo: '1.0.0' },
    });
    const finding = await analyzeRelease(next, null);
    expect(finding.signals.every(s => s.type === 'baseline_dependency')).toBe(true);
    expect(finding.severity).toBe('info');
  });

  it('detects new lifecycle script as high', async () => {
    const prev = makeManifest({ scripts: {} });
    const next = makeManifest({
      version: '2.51.0',
      scripts: { postinstall: 'node malicious.js' },
    });
    const finding = await analyzeRelease(next, prev);
    expect(finding.severity).toBe('high');
    expect(finding.signals.some(s => s.type === 'lifecycle_script_added')).toBe(true);
  });

  it('detects changed lifecycle script as warning', async () => {
    const prev = makeManifest({ scripts: { postinstall: 'node setup.js' } });
    const next = makeManifest({
      version: '2.51.0',
      scripts: { postinstall: 'node different.js' },
    });
    const finding = await analyzeRelease(next, prev);
    expect(finding.signals.some(s => s.type === 'lifecycle_script_changed')).toBe(true);
  });

  it('elevates severity when new dep + high risky API', async () => {
    vi.mocked(scanTarball).mockResolvedValueOnce([
      { type: 'risky_api:child_process', detail: 'uses child_process', severity: 'high' },
    ]);

    const prev = makeManifest({ dependencies: {} });
    const next = makeManifest({
      version: '2.51.0',
      dependencies: { 'bad-pkg': '1.0.0' },
    });
    const finding = await analyzeRelease(next, prev);
    expect(finding.severity).toBe('high');
    expect(finding.signals.some(s => s.type === 'new_dep_with_risky_api')).toBe(true);
  });
});
