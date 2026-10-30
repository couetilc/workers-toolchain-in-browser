import type { Database } from '@sqlite.org/sqlite-wasm';
import { validatePath, type Snapshot } from './workspace';

export function database(db: Database) {
  const version = db.selectValue('PRAGMA user_version') as number;
  if (version > 1) throw new Error('Database version is newer than this application');
  if (version === 0) db.transaction(() => db.exec(`
    CREATE TABLE project (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL);
    CREATE TABLE files (path TEXT PRIMARY KEY, contents TEXT NOT NULL);
    CREATE TABLE sessions (id TEXT PRIMARY KEY, status TEXT NOT NULL CHECK(status IN ('running','completed','cancelled','failed','interrupted')), messages TEXT NOT NULL);
    PRAGMA user_version=1;
  `));
  db.exec("UPDATE sessions SET status='interrupted' WHERE status='running'");
  return {
    read(): Snapshot | null {
      const revision = db.selectValue('SELECT revision FROM project WHERE id=1');
      if (revision === undefined) return null;
      return { revision: revision as number, files: Object.fromEntries(db.selectArrays('SELECT path, contents FROM files') as [string, string][]) };
    },
    save(expected: number, snapshot: Snapshot) {
      db.transaction('IMMEDIATE', () => {
        const revision = db.selectValue('SELECT revision FROM project WHERE id=1') ?? -1;
        if (revision !== expected || snapshot.revision !== expected + 1) throw new Error('Storage revision conflict');
        db.exec('DELETE FROM files');
        for (const [path, contents] of Object.entries(snapshot.files)) {
          validatePath(path);
          db.exec({ sql: 'INSERT INTO files VALUES (?, ?)', bind: [path, contents] });
        }
        db.exec({ sql: 'INSERT OR REPLACE INTO project VALUES (1, ?)', bind: [snapshot.revision] });
      });
    },
    session() {
      const row = db.selectObject('SELECT status, messages FROM sessions WHERE id=?', ['default']);
      return row ? { status: String(row.status), messages: JSON.parse(String(row.messages)) as unknown[] } : null;
    },
    saveSession(status: string, messages: unknown[]) {
      db.exec({ sql: 'INSERT OR REPLACE INTO sessions VALUES (?, ?, ?)', bind: ['default', status, JSON.stringify(messages)] });
    },
    close: () => db.close(),
  };
}
