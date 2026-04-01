# HCS Alert Event Schema

## AlertEvent (v1)

Each alert published to HCS is a JSON-encoded `AlertEvent`:

```json
{
  "type": "package_alert",
  "version": 1,
  "timestamp": "2026-04-01T12:00:00.000Z",
  "package": "@hashgraph/sdk",
  "releaseVersion": "2.50.0",
  "previousVersion": "2.49.0",
  "severity": "warning",
  "signals": [
    {
      "type": "new_dependency",
      "detail": "new dependency: evil-pkg@1.0.0",
      "severity": "warning"
    }
  ],
  "findingId": "a1b2c3d4-..."
}
```

## Field reference

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"package_alert"` | Event type discriminator |
| `version` | `1` | Schema version for forward compatibility |
| `timestamp` | ISO 8601 string | When the alert was published |
| `package` | string | npm package name |
| `releaseVersion` | string | Newly detected version |
| `previousVersion` | string \| null | Last known version (null on first scan) |
| `severity` | `"info"` \| `"warning"` \| `"high"` | Overall severity |
| `signals` | Signal[] | Individual findings (see below) |
| `findingId` | UUID string | Correlates with local SQLite record |

## Signal object

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Signal category (see signal types below) |
| `detail` | string | Human-readable description |
| `severity` | `"info"` \| `"warning"` \| `"high"` | Signal-level severity |

## Signal types

| Type | Severity | Trigger |
|------|----------|---------|
| `baseline_dependency` | info | Dependency present on first scan |
| `new_dependency` | warning | Dependency added since previous version |
| `removed_dependency` | info | Dependency removed since previous version |
| `lifecycle_script_added` | high | New preinstall/install/postinstall script |
| `lifecycle_script_changed` | warning | Existing lifecycle script modified |
| `risky_api:child_process` | high | Source imports child_process |
| `risky_api:process.env` | warning | Source accesses process.env |
| `risky_api:fs` | warning | Source imports fs/node:fs |
| `risky_api:crypto` | warning | Source imports crypto/node:crypto |
| `new_dep_with_risky_api` | high | New dependency + high-risk API in same release |

## Decoding from hcs-trace

Events are submitted as plain UTF-8 JSON to the configured HCS topic. Any consumer can:
1. Filter by `type === "package_alert"`
2. Check `version` for schema compatibility
3. Parse the `signals` array for detailed analysis
