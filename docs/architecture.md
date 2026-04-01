# Architecture

## Overview

hcs-sentinel is a CLI tool that polls the npm registry for new releases of critical Hedera ecosystem packages, analyzes them for suspicious changes, stores findings in SQLite, and publishes structured alerts to an HCS topic.

## Module layout

```
src/
├── cli/              CLI entrypoint and command handlers
│   ├── index.ts      commander setup, bootstrap (config → db → parse)
│   └── commands/     one file per command (monitor, latest, inspect, scan-package)
├── config/
│   ├── index.ts      zod-validated env config loader
│   └── packages.ts   fixed allowlist of monitored packages
├── core/
│   ├── analyzer.ts   compares two versions: dep diff, lifecycle scripts, tarball scan
│   └── severity.ts   rule-based severity assignment from signals
├── db/
│   ├── index.ts      SQLite bootstrap (better-sqlite3, WAL mode)
│   ├── schema.ts     DDL for findings + package_state tables
│   └── repos/        data access functions (findings, package-state)
├── hcs/
│   ├── client.ts     Hedera client factory from env config
│   └── publisher.ts  serializes AlertEvent and submits to HCS topic
├── npm/
│   ├── registry.ts   fetch package metadata from registry.npmjs.org
│   ├── poller.ts     interval-based polling loop with new-version callback
│   └── tarball.ts    streams tarball through gunzip+tar, scans for risky patterns
├── types/
│   └── index.ts      shared types: Severity, Signal, Finding, AlertEvent
└── utils/
    └── logger.ts     pino logger (stderr, structured JSON)
```

## Data flow

```
npm registry  →  poller  →  analyzer  →  findings DB
                                      →  HCS publisher
```

1. **Poller** checks each monitored package's latest version against stored state
2. On new version: fetches full metadata, hands to **analyzer**
3. **Analyzer** diffs deps, checks lifecycle scripts, streams+scans tarball
4. Produces a **Finding** with signals and computed severity
5. Finding is stored in **SQLite** and published to **HCS** as an AlertEvent

## Design decisions

- **Streaming tarball scan**: tarballs are piped through zlib+tar in memory, never written to disk
- **Graceful HCS degradation**: if HCS credentials aren't configured, findings are stored locally and HCS publish is skipped with a warning
- **Baseline handling**: first scan of a package marks all signals as `info` severity to avoid false-positive floods
- **Structured logs to stderr**: pino JSON logs go to stderr, command output goes to stdout — clean for piping
