# Severity Rules

## Levels

| Level | Meaning |
|-------|---------|
| **high** | Immediate attention — likely malicious or highly unusual change |
| **warning** | Notable change worth reviewing — new surface area or drift |
| **info** | Normal release, baseline scan, or low-risk change |

## Signal → severity mapping

### High
- New lifecycle script introduced (`preinstall`, `install`, `postinstall`)
- `child_process` detected in package source
- New dependency introduced alongside a high-risk API detection

### Warning
- New dependency added
- Existing lifecycle script changed
- `process.env` access detected in source
- `fs` or `crypto` module usage detected in source

### Info
- Baseline dependency (first scan, no previous version to compare)
- Dependency removed
- Normal release with no risky signals

## Overall severity computation

The overall finding severity is the **maximum** of all individual signal severities:

```
if any signal is high    → finding is high
else if any is warning   → finding is warning
else                     → finding is info
```

## Escalation rules

These compound conditions produce additional high-severity signals:

| Condition | Signal type | Severity |
|-----------|-------------|----------|
| New dependency + any high risky API in same release | `new_dep_with_risky_api` | high |
