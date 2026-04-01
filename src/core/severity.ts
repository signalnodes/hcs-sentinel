import type { Signal, Severity } from '../types/index.js';

/**
 * Compute overall severity from a list of signals.
 * Escalation rules from the spec:
 *   high    — any child_process, any lifecycle_script_added, or new_dep + high signal
 *   warning — any new dependency, risky API (non-child_process), or metadata drift
 *   info    — everything else
 */
export function computeSeverity(signals: Signal[]): Severity {
  if (signals.some((s) => s.severity === 'high')) return 'high';
  if (signals.some((s) => s.severity === 'warning')) return 'warning';
  return 'info';
}
