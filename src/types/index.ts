/** Severity levels for findings */
export type Severity = 'info' | 'warning' | 'high';

/** A single risky signal detected during analysis */
export interface Signal {
  type: string;       // e.g. 'lifecycle_script', 'child_process', 'new_dependency'
  detail: string;     // human-readable description
  severity: Severity;
}

/** A complete finding for a package version */
export interface Finding {
  id: string;
  packageName: string;
  version: string;
  previousVersion: string | null;
  severity: Severity;
  signals: Signal[];
  createdAt: string;  // ISO 8601
  publishedToHcs: boolean;
}

/**
 * Alert event schema published to HCS.
 * Designed for clean decoding by hcs-trace or other consumers.
 */
export interface AlertEvent {
  type: 'package_alert';
  version: 1;
  timestamp: string;  // ISO 8601
  package: string;
  releaseVersion: string;
  previousVersion: string | null;
  severity: Severity;
  signals: Signal[];
  findingId: string;
  /** True when signal list was truncated to fit the HCS 4KB message limit */
  signalsTruncated?: boolean;
}
