import type { DatabaseSync } from 'node:sqlite';
import { jobsTableSql } from '../../core/scheduler';

// Each entry upgrades the schema by one version; PRAGMA user_version tracks
// how many have run. Never edit a shipped migration — append a new one.
const migrations: string[] = [
  `
  CREATE TABLE todos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    done INTEGER NOT NULL DEFAULT 0,
    estimate INTEGER NOT NULL DEFAULT 1,
    pomodoros INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER
  );

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    todo_id TEXT REFERENCES todos(id) ON DELETE SET NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    planned_minutes INTEGER NOT NULL,
    actual_minutes INTEGER NOT NULL,
    completed INTEGER NOT NULL,
    pause_count INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    mood INTEGER CHECK (mood BETWEEN 1 AND 5),
    date_key TEXT NOT NULL,
    hour INTEGER NOT NULL
  );
  CREATE INDEX sessions_by_date ON sessions(date_key);

  CREATE TABLE playlists (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE playlist_items (
    id TEXT PRIMARY KEY,
    playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    player TEXT NOT NULL,
    ref TEXT NOT NULL,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL
  );

  CREATE TABLE notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    pinned INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  `,
  // v2: scheduler jobs (core/scheduler.ts).
  jobsTableSql
];

export const migrate = (db: DatabaseSync) => {
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  const { user_version: current } = db.prepare('PRAGMA user_version').get() as { user_version: number };
  for (let version = current; version < migrations.length; version += 1) {
    db.exec('BEGIN');
    try {
      db.exec(migrations[version]);
      db.exec(`PRAGMA user_version = ${version + 1}`);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
};
