import type { Severity } from '../types/index.js';

const RESET = '\x1b[0m';
const RED   = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM   = '\x1b[2m';
const BOLD  = '\x1b[1m';

const SEVERITY_STYLE: Record<Severity, string> = {
  high:    `${RED}${BOLD}`,
  warning: `${YELLOW}`,
  info:    `${DIM}`,
};

/** Color a severity label for terminal output. */
export function colorSeverity(severity: Severity): string {
  const style = SEVERITY_STYLE[severity];
  return `${style}${severity.toUpperCase()}${RESET}`;
}

/** Color a signal-level severity tag. */
export function colorSignalTag(severity: Severity): string {
  const style = SEVERITY_STYLE[severity];
  return `${style}[${severity}]${RESET}`;
}

const SIGNALS_PREVIEW = 3;

/**
 * Print a finding to stdout.
 * @param full  When false, show only the top SIGNALS_PREVIEW signals with a count.
 */
export function printFinding(finding: import('../types/index.js').Finding, full = false): void {
  const published = finding.publishedToHcs ? '[HCS \u2713]' : '[HCS pending]';
  console.log(`\n${finding.packageName}@${finding.version}  ${colorSeverity(finding.severity)}  ${published}`);
  console.log(`  id:      ${finding.id}`);
  console.log(`  prev:    ${finding.previousVersion ?? 'n/a'}`);
  console.log(`  scanned: ${finding.createdAt}`);

  const { signals } = finding;
  if (signals.length === 0) {
    console.log('  signals: none');
    return;
  }

  // Sort: high → warning → info
  const sorted = [...signals].sort((a, b) => {
    const order = { high: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const shown = full ? sorted : sorted.slice(0, SIGNALS_PREVIEW);
  console.log('  signals:');
  for (const s of shown) {
    console.log(`    ${colorSignalTag(s.severity)} ${s.detail}`);
  }

  if (!full && signals.length > SIGNALS_PREVIEW) {
    console.log(`    … and ${signals.length - SIGNALS_PREVIEW} more  (use --full to see all)`);
  }
}
