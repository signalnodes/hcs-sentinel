import { describe, it, expect } from 'vitest';
import { computeSeverity } from '../src/core/severity.js';
import type { Signal } from '../src/types/index.js';

describe('computeSeverity', () => {
  it('returns info when no signals', () => {
    expect(computeSeverity([])).toBe('info');
  });

  it('returns info when all signals are info', () => {
    const signals: Signal[] = [
      { type: 'baseline_dependency', detail: 'test', severity: 'info' },
      { type: 'removed_dependency', detail: 'test', severity: 'info' },
    ];
    expect(computeSeverity(signals)).toBe('info');
  });

  it('returns warning when highest signal is warning', () => {
    const signals: Signal[] = [
      { type: 'baseline_dependency', detail: 'test', severity: 'info' },
      { type: 'new_dependency', detail: 'test', severity: 'warning' },
    ];
    expect(computeSeverity(signals)).toBe('warning');
  });

  it('returns high when any signal is high', () => {
    const signals: Signal[] = [
      { type: 'new_dependency', detail: 'test', severity: 'warning' },
      { type: 'lifecycle_script_added', detail: 'test', severity: 'high' },
    ];
    expect(computeSeverity(signals)).toBe('high');
  });

  it('returns high even with mixed severities', () => {
    const signals: Signal[] = [
      { type: 'baseline_dependency', detail: 'test', severity: 'info' },
      { type: 'new_dependency', detail: 'test', severity: 'warning' },
      { type: 'risky_api:child_process', detail: 'test', severity: 'high' },
    ];
    expect(computeSeverity(signals)).toBe('high');
  });
});
