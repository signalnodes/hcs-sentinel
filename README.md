# hcs-sentinel

Real-time package release monitoring for critical Hedera ecosystem npm dependencies. `hcs-sentinel` detects new releases, analyzes them for suspicious changes, stores findings locally, and can publish structured alert events to an HCS topic.

## Example output

Detects suspicious package changes and publishes tamper-evident alerts to HCS:
![hcs-sentinel output](./docs/screenshot.png)

## Status

**v0.1.0 is an experimental testnet-first release.**  
The current goal is to prove the end-to-end monitoring, analysis, and HCS attestation pipeline for critical Hedera ecosystem packages.

## Monitored packages

- `@hashgraph/sdk`
- `@hashgraph/proto`
- `@hashgraphonline/standards-sdk`
- `@hashgraphonline/standards-agent-kit`

## What it detects

- New or removed dependencies
- Lifecycle scripts (`preinstall`, `install`, `postinstall`)
- Risky API usage:
  - `child_process`
  - `process.env`
  - `fs`
  - `crypto`
- Compound risk:
  - new dependency + high-risk API in the same release

## Current behavior

- Polls monitored packages on an interval
- Stores findings locally in SQLite
- Publishes alert events to HCS when Hedera credentials and a topic ID are configured
- Runs in local-only mode if HCS is not configured

## Setup

```bash
cp .env.example .env
# fill in HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, HEDERA_NETWORK, and HCS_TOPIC_ID
npm install
```

## Usage

```bash
# Start continuous monitoring
npm run dev -- monitor

# One-shot scan of a package
npm run dev -- scan-package @hashgraph/sdk

# Scan without publishing to HCS
npm run dev -- scan-package @hashgraph/sdk --no-publish

# Show latest finding per monitored package
npm run dev -- latest

# Inspect a specific finding by ID
npm run dev -- inspect <findingId>
```

## Testing

```bash
npm test
```

## Configuration

All config is provided via environment variables or `.env`.

| Variable | Default | Description |
|----------|---------|-------------|
| `HEDERA_ACCOUNT_ID` | — | Hedera account ID used for HCS publishing |
| `HEDERA_PRIVATE_KEY` | — | Private key for the Hedera account |
| `HEDERA_NETWORK` | `testnet` | Hedera network: `testnet`, `mainnet`, or `previewnet` |
| `HCS_TOPIC_ID` | — | Topic ID for alert publishing |
| `POLL_INTERVAL_SECONDS` | `60` | Polling interval for monitor mode |
| `DB_PATH` | `data/sentinel.db` | SQLite database path |
| `LOG_LEVEL` | `info` | Logger verbosity |

## Notes

- This release is focused on testnet validation and MVP functionality.
- Findings may be truncated when published to HCS to fit message size limits.
- Initial baseline scans can be noisy and may include informational dependency observations.
- `hcs-sentinel` is a separate tool from `hcs-trace`; future decoder support can be added there.
