/** SQLite table definitions for hcs-sentinel */

export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS findings (
    id            TEXT PRIMARY KEY,
    package_name  TEXT NOT NULL,
    version       TEXT NOT NULL,
    prev_version  TEXT,
    severity      TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'high')),
    signals       TEXT NOT NULL,  -- JSON array of Signal objects
    created_at    TEXT NOT NULL,  -- ISO 8601
    published     INTEGER NOT NULL DEFAULT 0,

    UNIQUE(package_name, version)
  );

  CREATE TABLE IF NOT EXISTS package_state (
    package_name    TEXT PRIMARY KEY,
    latest_version  TEXT NOT NULL,
    last_checked    TEXT NOT NULL  -- ISO 8601
  );

  CREATE INDEX IF NOT EXISTS idx_findings_package
    ON findings(package_name);

  CREATE INDEX IF NOT EXISTS idx_findings_severity
    ON findings(severity);
`;
