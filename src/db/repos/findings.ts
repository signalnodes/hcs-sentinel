import { getDb } from '../index.js';
import type { Finding, Signal } from '../../types/index.js';

interface FindingRow {
  id: string;
  package_name: string;
  version: string;
  prev_version: string | null;
  severity: string;
  signals: string; // JSON
  created_at: string;
  published: number;
}

function rowToFinding(row: FindingRow): Finding {
  return {
    id: row.id,
    packageName: row.package_name,
    version: row.version,
    previousVersion: row.prev_version,
    severity: row.severity as Finding['severity'],
    signals: JSON.parse(row.signals) as Signal[],
    createdAt: row.created_at,
    publishedToHcs: row.published === 1,
  };
}

export function insertFinding(finding: Finding): void {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO findings
      (id, package_name, version, prev_version, severity, signals, created_at, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    finding.id,
    finding.packageName,
    finding.version,
    finding.previousVersion,
    finding.severity,
    JSON.stringify(finding.signals),
    finding.createdAt,
    finding.publishedToHcs ? 1 : 0,
  );
}

export function getFinding(id: string): Finding | null {
  const db = getDb();
  const row = db
    .prepare('SELECT * FROM findings WHERE id = ?')
    .get(id) as FindingRow | undefined;
  return row ? rowToFinding(row) : null;
}

/** One finding per package — the most recent. */
export function getLatestFindings(): Finding[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT f.*
    FROM findings f
    INNER JOIN (
      SELECT package_name, MAX(created_at) AS max_ts
      FROM findings
      GROUP BY package_name
    ) latest ON f.package_name = latest.package_name AND f.created_at = latest.max_ts
    ORDER BY f.created_at DESC
  `).all() as FindingRow[];
  return rows.map(rowToFinding);
}

export function getUnpublishedFindings(): Finding[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM findings WHERE published = 0 ORDER BY created_at ASC')
    .all() as FindingRow[];
  return rows.map(rowToFinding);
}

export function markPublished(id: string): void {
  const db = getDb();
  db.prepare('UPDATE findings SET published = 1 WHERE id = ?').run(id);
}

/** Returns true if a finding already exists for this exact package+version. */
export function findingExistsForVersion(packageName: string, version: string): boolean {
  const db = getDb();
  const row = db
    .prepare('SELECT 1 FROM findings WHERE package_name = ? AND version = ?')
    .get(packageName, version);
  return row !== undefined;
}

/** All findings for a specific package, newest first. */
export function getFindingsForPackage(packageName: string): Finding[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT * FROM findings WHERE package_name = ? ORDER BY created_at DESC')
    .all(packageName) as FindingRow[];
  return rows.map(rowToFinding);
}
