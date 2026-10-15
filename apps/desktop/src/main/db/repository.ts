import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { isSupportedPlayer, isValidMusicRef, type PlayerName } from '../../shared/music';
import { normalizeSettings, type AppSettings } from '../../shared/settings';
import type { DailyFocus, FocusSessionRecord, HourlyFocus, Note, Playlist, PlaylistItem, Todo } from '../../shared/types';

type Row = Record<string, unknown>;

const toTodo = (row: Row): Todo => ({
  id: String(row.id),
  title: String(row.title),
  done: row.done === 1,
  estimate: Number(row.estimate),
  pomodoros: Number(row.pomodoros),
  position: Number(row.position),
  createdAt: Number(row.created_at),
  completedAt: row.completed_at === null ? null : Number(row.completed_at)
});

const toItem = (row: Row): PlaylistItem => ({
  id: String(row.id),
  playlistId: String(row.playlist_id),
  player: row.player as PlayerName,
  ref: String(row.ref),
  title: String(row.title),
  artist: String(row.artist),
  position: Number(row.position)
});

const toNote = (row: Row): Note => ({
  id: String(row.id),
  title: String(row.title),
  body: String(row.body),
  pinned: row.pinned === 1,
  createdAt: Number(row.created_at),
  updatedAt: Number(row.updated_at)
});

const cleanText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.trim().slice(0, max) : '';

const clampInt = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;

export const createRepository = (db: DatabaseSync) => {
  const transaction = <T>(fn: () => T): T => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };

  const nextPosition = (table: 'todos' | 'playlist_items', where = '', ...params: string[]) => {
    const row = db.prepare(`SELECT COALESCE(MAX(position), -1) + 1 AS next FROM ${table} ${where}`).get(...params) as Row;
    return Number(row.next);
  };

  // Swaps `position` with the neighbour in the given ordered sibling list.
  const swapWithNeighbour = (table: 'todos' | 'playlist_items', ids: string[], id: string, delta: number) => {
    const index = ids.indexOf(id);
    const target = index + Math.sign(delta);
    if (index < 0 || target < 0 || target >= ids.length) return;
    const get = db.prepare(`SELECT position FROM ${table} WHERE id = ?`);
    const set = db.prepare(`UPDATE ${table} SET position = ? WHERE id = ?`);
    const a = (get.get(ids[index]) as Row).position as number;
    const b = (get.get(ids[target]) as Row).position as number;
    transaction(() => {
      set.run(b, ids[index]);
      set.run(a, ids[target]);
    });
  };

  const getSettings = (): AppSettings => {
    const rows = db.prepare('SELECT key, value FROM settings').all() as Row[];
    return normalizeSettings(Object.fromEntries(rows.map((row) => [row.key, JSON.parse(String(row.value))])));
  };

  const repository = {
    // ---------- todos ----------
    listTodos: (): Todo[] =>
      (db.prepare('SELECT * FROM todos ORDER BY done ASC, position ASC').all() as Row[]).map(toTodo),

    addTodo: (title: unknown, estimate: unknown = 1): Todo | null => {
      const clean = cleanText(title, 80);
      if (!clean) return null;
      const id = randomUUID();
      db.prepare('INSERT INTO todos (id, title, estimate, position, created_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        clean,
        clampInt(estimate, 1, 12, 1),
        nextPosition('todos'),
        Date.now()
      );
      return toTodo(db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Row);
    },

    updateTodo: (id: unknown, patch: { title?: unknown; estimate?: unknown }) => {
      if (typeof id !== 'string') return;
      const title = cleanText(patch.title, 80);
      if (title) db.prepare('UPDATE todos SET title = ? WHERE id = ?').run(title, id);
      if (patch.estimate !== undefined) {
        db.prepare('UPDATE todos SET estimate = ? WHERE id = ?').run(clampInt(patch.estimate, 1, 12, 1), id);
      }
    },

    setTodoDone: (id: unknown, done: unknown) => {
      if (typeof id !== 'string') return;
      db.prepare('UPDATE todos SET done = ?, completed_at = ? WHERE id = ?').run(done ? 1 : 0, done ? Date.now() : null, id);
    },

    deleteTodo: (id: unknown) => {
      if (typeof id === 'string') db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    },

    moveTodo: (id: unknown, delta: unknown) => {
      if (typeof id !== 'string' || typeof delta !== 'number') return;
      const ids = (db.prepare('SELECT id FROM todos WHERE done = 0 ORDER BY position').all() as Row[]).map((r) => String(r.id));
      swapWithNeighbour('todos', ids, id, delta);
    },

    clearCompletedTodos: () => {
      db.prepare('DELETE FROM todos WHERE done = 1').run();
    },

    // ---------- focus sessions ----------
    recordFocusSession: (record: Omit<FocusSessionRecord, 'id'> & { actualMinutes: number; pauseCount: number }) => {
      transaction(() => {
        db.prepare(
          `INSERT INTO sessions (id, todo_id, started_at, ended_at, planned_minutes, actual_minutes, completed, pause_count, date_key, hour)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          randomUUID(),
          typeof record.todoId === 'string' ? record.todoId : null,
          record.startedAt,
          record.endedAt,
          clampInt(record.plannedMinutes, 0, 600, 0),
          clampInt(record.actualMinutes, 0, 600, 0),
          record.completed ? 1 : 0,
          clampInt(record.pauseCount, 0, 999, 0),
          String(record.dateKey),
          clampInt(record.hour, 0, 23, 0)
        );
        if (record.completed && typeof record.todoId === 'string') {
          db.prepare('UPDATE todos SET pomodoros = pomodoros + 1 WHERE id = ?').run(record.todoId);
        }
      });
    },

    // Short post-session reflection: a note and a 1–5 focus rating.
    setLastSessionReflection: (note: unknown, mood: unknown) => {
      const clean = cleanText(note, 280);
      db.prepare(
        'UPDATE sessions SET note = ?, mood = ? WHERE id = (SELECT id FROM sessions ORDER BY ended_at DESC LIMIT 1)'
      ).run(clean || null, typeof mood === 'number' ? clampInt(mood, 1, 5, 3) : null);
    },

    getDailyFocus: (fromKey: string, toKey: string): DailyFocus[] =>
      (
        db
          .prepare(
            `SELECT date_key, SUM(actual_minutes) AS minutes, COUNT(*) AS sessions FROM sessions
             WHERE completed = 1 AND date_key BETWEEN ? AND ? GROUP BY date_key ORDER BY date_key`
          )
          .all(fromKey, toKey) as Row[]
      ).map((row) => ({ dateKey: String(row.date_key), minutes: Number(row.minutes), sessions: Number(row.sessions) })),

    getHourlyFocus: (fromKey: string, toKey: string): HourlyFocus[] =>
      (
        db
          .prepare(
            `SELECT hour, SUM(actual_minutes) AS minutes FROM sessions
             WHERE completed = 1 AND date_key BETWEEN ? AND ? GROUP BY hour ORDER BY hour`
          )
          .all(fromKey, toKey) as Row[]
      ).map((row) => ({ hour: Number(row.hour), minutes: Number(row.minutes) })),

    getSessionSummary: (fromKey: string, toKey: string) => {
      const row = db
        .prepare(
          `SELECT
             COALESCE(SUM(completed = 1), 0) AS completed,
             COALESCE(SUM(completed = 0), 0) AS abandoned,
             COALESCE(SUM(pause_count), 0) AS pauses,
             COALESCE(AVG(CASE WHEN completed = 1 THEN actual_minutes END), 0) AS avg_minutes,
             AVG(mood) AS avg_mood
           FROM sessions WHERE date_key BETWEEN ? AND ?`
        )
        .get(fromKey, toKey) as Row;
      return {
        completed: Number(row.completed),
        abandoned: Number(row.abandoned),
        pauses: Number(row.pauses),
        averageMinutes: Math.round(Number(row.avg_minutes)),
        averageMood: row.avg_mood === null ? null : Math.round(Number(row.avg_mood) * 10) / 10
      };
    },

    listRecentSessions: (limit = 8) =>
      (
        db
          .prepare(
            `SELECT s.ended_at, s.actual_minutes, s.completed, s.note, s.mood, t.title AS todo_title
             FROM sessions s LEFT JOIN todos t ON t.id = s.todo_id ORDER BY s.ended_at DESC LIMIT ?`
          )
          .all(clampInt(limit, 1, 50, 8)) as Row[]
      ).map((row) => ({
        endedAt: Number(row.ended_at),
        minutes: Number(row.actual_minutes),
        completed: row.completed === 1,
        note: row.note === null ? null : String(row.note),
        mood: row.mood === null ? null : Number(row.mood),
        todoTitle: row.todo_title === null ? null : String(row.todo_title)
      })),

    // Focus records for the history list, newest first. Bounds are inclusive
    // date keys; anything else means open-ended.
    listSessions: (fromKey: unknown = null, toKey: unknown = null, limit: unknown = 500) => {
      const key = (value: unknown, fallback: string) =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
      return (
        db
          .prepare(
            `SELECT s.id, s.todo_id, s.started_at, s.ended_at, s.planned_minutes, s.actual_minutes, s.completed, s.pause_count,
                    s.note, s.mood, s.date_key, t.title AS todo_title
             FROM sessions s LEFT JOIN todos t ON t.id = s.todo_id
             WHERE s.date_key BETWEEN ? AND ? ORDER BY s.ended_at DESC LIMIT ?`
          )
          .all(key(fromKey, '0000-00-00'), key(toKey, '9999-99-99'), clampInt(limit, 1, 2000, 500)) as Row[]
      ).map((row) => ({
        id: String(row.id),
        todoId: row.todo_id === null ? null : String(row.todo_id),
        startedAt: Number(row.started_at),
        endedAt: Number(row.ended_at),
        plannedMinutes: Number(row.planned_minutes),
        minutes: Number(row.actual_minutes),
        completed: row.completed === 1,
        pauseCount: Number(row.pause_count),
        note: row.note === null ? null : String(row.note),
        mood: row.mood === null ? null : Number(row.mood),
        dateKey: String(row.date_key),
        todoTitle: row.todo_title === null ? null : String(row.todo_title)
      }));
    },

    // ---------- settings & key-value ----------
    getSettings,

    updateSettings: (patch: unknown): AppSettings => {
      const next = normalizeSettings({ ...getSettings(), ...(typeof patch === 'object' && patch !== null ? patch : {}) });
      const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
      transaction(() => {
        for (const [key, value] of Object.entries(next)) upsert.run(key, JSON.stringify(value));
      });
      return next;
    },

    getKv: (key: unknown): string | null => {
      if (typeof key !== 'string') return null;
      const row = db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as Row | undefined;
      return row ? String(row.value) : null;
    },

    setKv: (key: unknown, value: unknown) => {
      if (typeof key !== 'string' || typeof value !== 'string') return;
      db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    },

    removeKv: (key: unknown) => {
      if (typeof key === 'string') db.prepare('DELETE FROM kv WHERE key = ?').run(key);
    },

    // ---------- notes ----------
    listNotes: (query: unknown = ''): Note[] => {
      const term = cleanText(query, 80).replace(/[\\%_]/g, (c) => `\\${c}`);
      return (
        db
          .prepare(
            `SELECT * FROM notes WHERE title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'
             ORDER BY pinned DESC, updated_at DESC, rowid DESC`
          )
          .all(`%${term}%`, `%${term}%`) as Row[]
      ).map(toNote);
    },

    createNote: (title: unknown = '', body: unknown = ''): Note | null => {
      const cleanTitle = cleanText(title, 80);
      const cleanBody = typeof body === 'string' ? body.slice(0, 20_000) : '';
      if (!cleanTitle && !cleanBody.trim()) return null;
      const id = randomUUID();
      const now = Date.now();
      db.prepare('INSERT INTO notes (id, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(
        id,
        cleanTitle,
        cleanBody,
        now,
        now
      );
      return toNote(db.prepare('SELECT * FROM notes WHERE id = ?').get(id) as Row);
    },

    updateNote: (id: unknown, patch: { title?: unknown; body?: unknown; pinned?: unknown }) => {
      if (typeof id !== 'string') return;
      const now = Date.now();
      if (typeof patch.title === 'string') db.prepare('UPDATE notes SET title = ?, updated_at = ? WHERE id = ?').run(cleanText(patch.title, 80), now, id);
      if (typeof patch.body === 'string') db.prepare('UPDATE notes SET body = ?, updated_at = ? WHERE id = ?').run(patch.body.slice(0, 20_000), now, id);
      if (typeof patch.pinned === 'boolean') db.prepare('UPDATE notes SET pinned = ? WHERE id = ?').run(patch.pinned ? 1 : 0, id);
    },

    deleteNote: (id: unknown) => {
      if (typeof id === 'string') db.prepare('DELETE FROM notes WHERE id = ?').run(id);
    },

    // ---------- playlists ----------
    listPlaylists: (): Playlist[] => {
      const items = (db.prepare('SELECT * FROM playlist_items ORDER BY position').all() as Row[]).map(toItem);
      return (db.prepare('SELECT * FROM playlists ORDER BY created_at').all() as Row[]).map((row) => ({
        id: String(row.id),
        name: String(row.name),
        createdAt: Number(row.created_at),
        items: items.filter((item) => item.playlistId === row.id)
      }));
    },

    createPlaylist: (name: unknown): string | null => {
      const clean = cleanText(name, 40);
      if (!clean) return null;
      const id = randomUUID();
      db.prepare('INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)').run(id, clean, Date.now());
      return id;
    },

    renamePlaylist: (id: unknown, name: unknown) => {
      const clean = cleanText(name, 40);
      if (typeof id === 'string' && clean) db.prepare('UPDATE playlists SET name = ? WHERE id = ?').run(clean, id);
    },

    deletePlaylist: (id: unknown) => {
      if (typeof id !== 'string') return;
      db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
      const settings = getSettings();
      if (settings.focusPlaylistId === id || settings.breakPlaylistId === id) {
        repository.updateSettings({
          focusPlaylistId: settings.focusPlaylistId === id ? null : settings.focusPlaylistId,
          breakPlaylistId: settings.breakPlaylistId === id ? null : settings.breakPlaylistId
        });
      }
    },

    addPlaylistItem: (playlistId: unknown, item: { player?: unknown; ref?: unknown; title?: unknown; artist?: unknown }) => {
      if (typeof playlistId !== 'string' || !isSupportedPlayer(item.player) || !isValidMusicRef(item.player, item.ref)) {
        return false;
      }
      db.prepare(
        'INSERT INTO playlist_items (id, playlist_id, player, ref, title, artist, position) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        randomUUID(),
        playlistId,
        item.player,
        item.ref,
        cleanText(item.title, 120) || item.ref,
        cleanText(item.artist, 120),
        nextPosition('playlist_items', 'WHERE playlist_id = ?', playlistId)
      );
      return true;
    },

    getPlaylistItem: (id: unknown): PlaylistItem | null => {
      if (typeof id !== 'string') return null;
      const row = db.prepare('SELECT * FROM playlist_items WHERE id = ?').get(id) as Row | undefined;
      return row ? toItem(row) : null;
    },

    removePlaylistItem: (id: unknown) => {
      if (typeof id === 'string') db.prepare('DELETE FROM playlist_items WHERE id = ?').run(id);
    },

    movePlaylistItem: (id: unknown, delta: unknown) => {
      if (typeof id !== 'string' || typeof delta !== 'number') return;
      const row = db.prepare('SELECT playlist_id FROM playlist_items WHERE id = ?').get(id) as Row | undefined;
      if (!row) return;
      const ids = (
        db.prepare('SELECT id FROM playlist_items WHERE playlist_id = ? ORDER BY position').all(String(row.playlist_id)) as Row[]
      ).map((r) => String(r.id));
      swapWithNeighbour('playlist_items', ids, id, delta);
    }
  };

  return repository;
};

export type Repository = ReturnType<typeof createRepository>;
export type RepositoryMethod = keyof Repository;
