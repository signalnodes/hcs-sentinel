# Database Schema

SQLite database stored at the path configured by `DB_PATH` (default: `data/sentinel.db`). Uses WAL journal mode.

## Tables

### findings

Stores analysis results for each package version scanned.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | TEXT | PRIMARY KEY | UUID |
| `package_name` | TEXT | NOT NULL | npm package name |
| `version` | TEXT | NOT NULL | Version that was analyzed |
| `prev_version` | TEXT | nullable | Previous known version |
| `severity` | TEXT | NOT NULL, CHECK in (info, warning, high) | Overall severity |
| `signals` | TEXT | NOT NULL | JSON array of Signal objects |
| `created_at` | TEXT | NOT NULL | ISO 8601 timestamp |
| `published` | INTEGER | NOT NULL, default 0 | 1 if published to HCS |

**Unique constraint**: `(package_name, version)` — one finding per package per version.

**Indexes**:
- `idx_findings_package` on `package_name`
- `idx_findings_severity` on `severity`

### package_state

Tracks the last-known version of each monitored package.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `package_name` | TEXT | PRIMARY KEY | npm package name |
| `latest_version` | TEXT | NOT NULL | Last version seen |
| `last_checked` | TEXT | NOT NULL | ISO 8601 timestamp |
