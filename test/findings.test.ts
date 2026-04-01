import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CREATE_TABLES } from '../src/db/schema.js';
import type { Finding } from '../src/types/index.js';

// Use an in-memory DB to avoid touching the real one.
// We test the repo functions' SQL by duplicating the logic
// against the same schema — keeps tests isolated from singletons.

function makeDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(CREATE_TABLES);
  return db;
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'test-id-1',
    packageName: '@hashgraph/sdk',
    version: '2.50.0',
    previousVersion: '2.49.0',
    severity: 'warning',
    signals: [{ type: 'new_dependency', detail: 'test dep', severity: 'warning' }],
    createdAt: '2026-01-01T00:00:00.000Z',
    publishedToHcs: false,
    ...overrides,
  };
}

describe('findings schema', () => {
  let db: Database.Database;

  beforeEach(() => { db = makeDb(); });
  afterEach(() => { db.close(); });

  it('inserts and retrieves a finding', () => {
    const f = makeFinding();
    db.prepare(`
      INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(f.id, f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0);

    const row = db.prepare('SELECT * FROM findings WHERE id = ?').get(f.id) as any;
    expect(row.package_name).toBe('@hashgraph/sdk');
    expect(row.severity).toBe('warning');
    expect(JSON.parse(row.signals)).toHaveLength(1);
  });

  it('enforces unique package+version', () => {
    const f = makeFinding();
    const insert = db.prepare(`
      INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(f.id, f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0);

    // Second insert with same package+version but different id should fail
    expect(() =>
      insert.run('other-id', f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0)
    ).toThrow();
  });

  it('enforces valid severity values', () => {
    const f = makeFinding();
    expect(() =>
      db.prepare(`
        INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(f.id, f.packageName, f.version, f.previousVersion, 'critical', JSON.stringify(f.signals), f.createdAt, 0)
    ).toThrow();
  });

  it('marks a finding as published', () => {
    const f = makeFinding();
    db.prepare(`
      INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(f.id, f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0);

    db.prepare('UPDATE findings SET published = 1 WHERE id = ?').run(f.id);
    const row = db.prepare('SELECT published FROM findings WHERE id = ?').get(f.id) as any;
    expect(row.published).toBe(1);
  });

  it('detects existing finding for package+version', () => {
    const f = makeFinding();
    db.prepare(`
      INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(f.id, f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0);

    const exists = db.prepare('SELECT 1 FROM findings WHERE package_name = ? AND version = ?')
      .get(f.packageName, f.version);
    expect(exists).toBeDefined();

    const notExists = db.prepare('SELECT 1 FROM findings WHERE package_name = ? AND version = ?')
      .get(f.packageName, '9.9.9');
    expect(notExists).toBeUndefined();
  });

  it('retrieves all findings for a package newest first', () => {
    const insert = db.prepare(`
      INSERT INTO findings (id, package_name, version, prev_version, severity, signals, created_at, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const f1 = makeFinding({ id: 'id-1', version: '2.50.0', createdAt: '2026-01-01T00:00:00.000Z' });
    const f2 = makeFinding({ id: 'id-2', version: '2.51.0', createdAt: '2026-01-02T00:00:00.000Z' });
    const other = makeFinding({ id: 'id-3', packageName: '@other/pkg', version: '1.0.0', createdAt: '2026-01-03T00:00:00.000Z' });

    for (const f of [f1, f2, other]) {
      insert.run(f.id, f.packageName, f.version, f.previousVersion, f.severity, JSON.stringify(f.signals), f.createdAt, 0);
    }

    const rows = db.prepare(
      'SELECT * FROM findings WHERE package_name = ? ORDER BY created_at DESC'
    ).all('@hashgraph/sdk') as any[];

    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe('id-2'); // newest first
    expect(rows[1].id).toBe('id-1');
  });
});
