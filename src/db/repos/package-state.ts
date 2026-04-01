import { getDb } from '../index.js';

export interface PackageStateRow {
  packageName: string;
  latestVersion: string;
  lastChecked: string; // ISO 8601
}

export function getPackageState(packageName: string): PackageStateRow | null {
  const db = getDb();
  const row = db
    .prepare('SELECT package_name, latest_version, last_checked FROM package_state WHERE package_name = ?')
    .get(packageName) as { package_name: string; latest_version: string; last_checked: string } | undefined;

  if (!row) return null;
  return {
    packageName: row.package_name,
    latestVersion: row.latest_version,
    lastChecked: row.last_checked,
  };
}

export function getAllPackageStates(): PackageStateRow[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT package_name, latest_version, last_checked FROM package_state ORDER BY package_name')
    .all() as { package_name: string; latest_version: string; last_checked: string }[];
  return rows.map(row => ({
    packageName: row.package_name,
    latestVersion: row.latest_version,
    lastChecked: row.last_checked,
  }));
}

export function upsertPackageState(packageName: string, latestVersion: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO package_state (package_name, latest_version, last_checked)
    VALUES (?, ?, ?)
    ON CONFLICT(package_name) DO UPDATE SET
      latest_version = excluded.latest_version,
      last_checked   = excluded.last_checked
  `).run(packageName, latestVersion, new Date().toISOString());
}
