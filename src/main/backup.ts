import type { DatabaseSync } from 'node:sqlite';
import * as z from 'zod/v4';
import { isSupportedPlayer, type PlayerName } from '../shared/music';
import { normalizeSettings } from '../shared/settings';

// JSON backup of everything the user made: todos, notes, focus records,
// playlists, settings and user key-value state. No Electron imports, so it
// runs (and is tested) against a plain node:sqlite database.

export const BACKUP_FORMAT = 'study-pet-backup@1';

// Credentials never leave this machine. Match loosely: a false positive only
// means one harmless value isn't carried over.
const SECRET_PARTS = ['token', 'apikey', 'api_key', 'api-key', 'secret', 'password', 'credential', 'auth', 'key.'];
// Screen positions belong to this computer's monitors, not to the user's data.
const DEVICE_KEYS = new Set(['pet.anchor', 'window.position']);

export const isSecretKey = (key: string) => {
  const lower = key.toLowerCase();
  return lower === 'key' || lower.endsWith('.key') || SECRET_PARTS.some((part) => lower.includes(part));
};

export const isPortableKv = (key: string) => !isSecretKey(key) && !DEVICE_KEYS.has(key);

// The persisted pet session ('session') mixes lasting progress with the live
// timer. A restored timer could "finish" a stale focus session on the next
// tick, so the live part always stays this device's.
const SESSION_KEY = 'session';
const LIVE_SESSION_FIELDS = ['timer', 'scene', 'pauseCount', 'awaitingReflection'];

const mergeSession = (imported: string, current: string | null): string | null => {
  try {
    const next = JSON.parse(imported) as { state?: Record<string, unknown> };
    if (!next || typeof next !== 'object' || typeof next.state !== 'object' || next.state === null) return current;
    const live = current ? ((JSON.parse(current) as { state?: Record<string, unknown> }).state ?? {}) : {};
    for (const field of LIVE_SESSION_FIELDS) {
      if (field in live) next.state[field] = live[field];
      else delete next.state[field];
    }
    return JSON.stringify(next);
  } catch {
    return current;
  }
};

const id = z.string().min(1).max(100);
const time = z.number().int().nonnegative();
const int = (min: number, max: number) => z.number().int().min(min).max(max);

const todoSchema = z.object({
  id,
  title: z.string().max(200),
  done: z.boolean(),
  estimate: int(1, 12),
  pomodoros: int(0, 100_000),
  position: z.number().int(),
  createdAt: time,
  completedAt: time.nullable()
});

const noteSchema = z.object({
  id,
  title: z.string().max(200),
  body: z.string().max(20_000),
  pinned: z.boolean(),
  createdAt: time,
  updatedAt: time
});

const sessionSchema = z.object({
  id,
  todoId: id.nullable(),
  startedAt: time,
  endedAt: time,
  plannedMinutes: int(0, 600),
  actualMinutes: int(0, 600),
  completed: z.boolean(),
  pauseCount: int(0, 999),
  note: z.string().max(280).nullable(),
  mood: int(1, 5).nullable(),
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hour: int(0, 23)
});

const playlistSchema = z.object({
  id,
  name: z.string().max(80),
  createdAt: time,
  items: z
    .array(
      z.object({
        id,
        player: z.string().refine((value): value is PlayerName => isSupportedPlayer(value), '지원하지 않는 플레이어'),
        ref: z.string().min(1).max(1024),
        title: z.string().max(200),
        artist: z.string().max(200),
        position: z.number().int()
      })
    )
    .max(5_000)
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  exportedAt: z.string(),
  appVersion: z.string(),
  todos: z.array(todoSchema).max(50_000),
  notes: z.array(noteSchema).max(50_000),
  sessions: z.array(sessionSchema).max(500_000),
  playlists: z.array(playlistSchema).max(1_000),
  settings: z.record(z.string(), z.unknown()),
  kv: z.record(z.string(), z.string())
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupSummary = { exportedAt: string; todos: number; notes: number; sessions: number; playlists: number };

type Row = Record<string, unknown>;
const all = (db: DatabaseSync, sql: string) => db.prepare(sql).all() as Row[];
const nullableNumber = (value: unknown) => (value === null ? null : Number(value));

export const createBackup = (db: DatabaseSync, appVersion: string, now = new Date()): Backup => {
  const items = all(db, 'SELECT * FROM playlist_items ORDER BY position');
  return {
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    appVersion,
    todos: all(db, 'SELECT * FROM todos ORDER BY position').map((r) => ({
      id: String(r.id),
      title: String(r.title),
      done: r.done === 1,
      estimate: Number(r.estimate),
      pomodoros: Number(r.pomodoros),
      position: Number(r.position),
      createdAt: Number(r.created_at),
      completedAt: nullableNumber(r.completed_at)
    })),
    notes: all(db, 'SELECT * FROM notes ORDER BY created_at').map((r) => ({
      id: String(r.id),
      title: String(r.title),
      body: String(r.body),
      pinned: r.pinned === 1,
      createdAt: Number(r.created_at),
      updatedAt: Number(r.updated_at)
    })),
    sessions: all(db, 'SELECT * FROM sessions ORDER BY ended_at').map((r) => ({
      id: String(r.id),
      todoId: r.todo_id === null ? null : String(r.todo_id),
      startedAt: Number(r.started_at),
      endedAt: Number(r.ended_at),
      plannedMinutes: Number(r.planned_minutes),
      actualMinutes: Number(r.actual_minutes),
      completed: r.completed === 1,
      pauseCount: Number(r.pause_count),
      note: r.note === null ? null : String(r.note),
      mood: nullableNumber(r.mood),
      dateKey: String(r.date_key),
      hour: Number(r.hour)
    })),
    playlists: all(db, 'SELECT * FROM playlists ORDER BY created_at').map((p) => ({
      id: String(p.id),
      name: String(p.name),
      createdAt: Number(p.created_at),
      items: items
        .filter((item) => item.playlist_id === p.id)
        .map((item) => ({
          id: String(item.id),
          player: String(item.player) as PlayerName,
          ref: String(item.ref),
          title: String(item.title),
          artist: String(item.artist),
          position: Number(item.position)
        }))
    })),
    settings: normalizeSettings(Object.fromEntries(all(db, 'SELECT key, value FROM settings').map((r) => [r.key, JSON.parse(String(r.value))]))),
    kv: Object.fromEntries(
      all(db, 'SELECT key, value FROM kv ORDER BY key')
        .filter((r) => isPortableKv(String(r.key)))
        .map((r) => [String(r.key), String(r.value)])
    )
  };
};

export const summarizeBackup = (backup: Backup): BackupSummary => ({
  exportedAt: backup.exportedAt,
  todos: backup.todos.length,
  notes: backup.notes.length,
  sessions: backup.sessions.length,
  playlists: backup.playlists.length
});

// Throws with a message the settings screen can show as is.
export const parseBackup = (text: string): Backup => {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('JSON 파일을 읽지 못했어요');
  }
  if (!json || typeof json !== 'object' || (json as Row).format !== BACKUP_FORMAT) {
    throw new Error('이 앱에서 내보낸 백업 파일이 아니에요');
  }
  const result = backupSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new Error(`백업 파일 내용이 올바르지 않아요 (${issue.path.join('.') || '전체'})`);
  }
  return result.data;
};

// Replaces all user data with the backup in one transaction: either every
// table is restored or nothing changes. Secret and device-only kv rows of
// this machine are kept.
export const restoreBackup = (db: DatabaseSync, backup: Backup) => {
  const currentSession = (db.prepare('SELECT value FROM kv WHERE key = ?').get(SESSION_KEY) as Row | undefined)?.value;
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM sessions; DELETE FROM todos; DELETE FROM notes; DELETE FROM playlist_items; DELETE FROM playlists; DELETE FROM settings;');
    const deleteKv = db.prepare('DELETE FROM kv WHERE key = ?');
    for (const row of all(db, 'SELECT key FROM kv')) if (isPortableKv(String(row.key))) deleteKv.run(String(row.key));

    const insertTodo = db.prepare(
      'INSERT INTO todos (id, title, done, estimate, pomodoros, position, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    for (const t of backup.todos) {
      insertTodo.run(t.id, t.title, t.done ? 1 : 0, t.estimate, t.pomodoros, t.position, t.createdAt, t.done ? t.completedAt : null);
    }

    const insertNote = db.prepare('INSERT INTO notes (id, title, body, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const n of backup.notes) insertNote.run(n.id, n.title, n.body, n.pinned ? 1 : 0, n.createdAt, n.updatedAt);

    // A session whose todo isn't in the backup becomes "자유 집중", like a
    // deleted todo does (ON DELETE SET NULL).
    const todoIds = new Set(backup.todos.map((t) => t.id));
    const insertSession = db.prepare(
      `INSERT INTO sessions (id, todo_id, started_at, ended_at, planned_minutes, actual_minutes, completed, pause_count, note, mood, date_key, hour)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const s of backup.sessions) {
      insertSession.run(
        s.id,
        s.todoId && todoIds.has(s.todoId) ? s.todoId : null,
        s.startedAt,
        s.endedAt,
        s.plannedMinutes,
        s.actualMinutes,
        s.completed ? 1 : 0,
        s.pauseCount,
        s.note,
        s.mood,
        s.dateKey,
        s.hour
      );
    }

    const insertPlaylist = db.prepare('INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)');
    const insertItem = db.prepare(
      'INSERT INTO playlist_items (id, playlist_id, player, ref, title, artist, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const p of backup.playlists) {
      insertPlaylist.run(p.id, p.name, p.createdAt);
      for (const item of p.items) insertItem.run(item.id, p.id, item.player, item.ref, item.title, item.artist, item.position);
    }

    const playlistIds = new Set(backup.playlists.map((p) => p.id));
    const settings = normalizeSettings(backup.settings);
    if (settings.focusPlaylistId && !playlistIds.has(settings.focusPlaylistId)) settings.focusPlaylistId = null;
    if (settings.breakPlaylistId && !playlistIds.has(settings.breakPlaylistId)) settings.breakPlaylistId = null;
    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of Object.entries(settings)) insertSetting.run(key, JSON.stringify(value));

    const upsertKv = db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const [key, value] of Object.entries(backup.kv)) {
      if (!isPortableKv(key)) continue;
      const stored = key === SESSION_KEY ? mergeSession(value, currentSession === undefined ? null : String(currentSession)) : value;
      if (stored !== null) upsertKv.run(key, stored);
    }
    if (!(SESSION_KEY in backup.kv) && currentSession !== undefined) upsertKv.run(SESSION_KEY, String(currentSession));
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`가져오지 못했어요: ${error instanceof Error ? error.message : String(error)}`);
  }
  return (db.prepare('SELECT value FROM kv WHERE key = ?').get(SESSION_KEY) as Row | undefined)?.value as string | undefined ?? null;
};
