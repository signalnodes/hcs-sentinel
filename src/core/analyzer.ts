/**
 * Analyzes a new npm package version against its previous version.
 * Produces a Finding with signals and severity.
 */

import { randomUUID } from 'node:crypto';
import type { Finding, Signal } from '../types/index.js';
import type { VersionManifest } from '../npm/registry.js';
import { scanTarball } from '../npm/tarball.js';
import { computeSeverity } from './severity.js';

/** Lifecycle scripts that are security-relevant */
const LIFECYCLE_SCRIPTS = ['preinstall', 'install', 'postinstall', 'preuninstall', 'uninstall'];

/**
 * Analyze a new release and return a Finding.
 *
 * @param newManifest   Registry manifest for the newly detected version
 * @param prevManifest  Registry manifest for the previously known version (null = first seen)
 */
export async function analyzeRelease(
  newManifest: VersionManifest,
  prevManifest: VersionManifest | null,
): Promise<Finding> {
  const signals: Signal[] = [];

  // --- Dependency diff ---
  const prevDeps = { ...prevManifest?.dependencies, ...prevManifest?.devDependencies };
  const newDeps  = { ...newManifest.dependencies,  ...newManifest.devDependencies };
  const isBaseline = prevManifest === null;

  for (const dep of Object.keys(newDeps)) {
    if (!(dep in prevDeps)) {
      signals.push({
        type: isBaseline ? 'baseline_dependency' : 'new_dependency',
        detail: isBaseline
          ? `baseline dependency: ${dep}@${newDeps[dep]}`
          : `new dependency: ${dep}@${newDeps[dep]}`,
        severity: isBaseline ? 'info' : 'warning',
      });
    }
  }

  if (!isBaseline) {
    for (const dep of Object.keys(prevDeps)) {
      if (!(dep in newDeps)) {
        // Dependency removed
        signals.push({
          type: 'removed_dependency',
          detail: `removed dependency: ${dep}`,
          severity: 'info',
        });
      } else if (newDeps[dep] !== prevDeps[dep]) {
        // Dependency version changed — major bumps are more notable but we surface all
        signals.push({
          type: 'dependency_version_changed',
          detail: `dependency version changed: ${dep} ${prevDeps[dep]} → ${newDeps[dep]}`,
          severity: 'info',
        });
      }
    }
  }

  // --- Lifecycle scripts ---
  const prevScripts = prevManifest?.scripts ?? {};
  const newScripts  = newManifest.scripts ?? {};

  for (const script of LIFECYCLE_SCRIPTS) {
    const isNew = newScripts[script] && !prevScripts[script];
    const changed = newScripts[script] && prevScripts[script] && newScripts[script] !== prevScripts[script];

    if (isNew) {
      // Do NOT include the raw script body in the detail — it is attacker-controlled
      // content that would be broadcast verbatim to the public HCS topic.
      signals.push({
        type: 'lifecycle_script_added',
        detail: `new ${script} script added`,
        severity: 'high',
      });
    } else if (changed) {
      signals.push({
        type: 'lifecycle_script_changed',
        detail: `${script} script changed`,
        severity: 'warning',
      });
    }
  }

  // --- Tarball source scan ---
  const tarballSignals = await scanTarball(newManifest.dist.tarball);
  signals.push(...tarballSignals);

  // --- Elevate severity: new dep + high risky signal ---
  const hasNewDep = signals.some((s) => s.type === 'new_dependency');
  const hasHighRisky = tarballSignals.some((s) => s.severity === 'high');
  if (hasNewDep && hasHighRisky) {
    signals.push({
      type: 'new_dep_with_risky_api',
      detail: 'new dependency introduced alongside high-risk API usage',
      severity: 'high',
    });
  }

  const severity = computeSeverity(signals);

  return {
    id: randomUUID(),
    packageName: newManifest.name,
    version: newManifest.version,
    previousVersion: prevManifest?.version ?? null,
    severity,
    signals,
    createdAt: new Date().toISOString(),
    publishedToHcs: false,
  };
}
