/**
 * Fixed allowlist of npm packages to monitor.
 * These are critical Hedera ecosystem packages — not local dependencies.
 */
export const MONITORED_PACKAGES = [
  '@hashgraph/sdk',
  '@hashgraph/proto',
  '@hashgraphonline/standards-sdk',
  '@hashgraphonline/standards-agent-kit',
] as const;

export type MonitoredPackage = (typeof MONITORED_PACKAGES)[number];
