import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { createRepository, type Repository } from './repository';
import { migrate } from './schema';

// Vite strips the `node:` prefix from imports it does not know, so load the
// built-in through Node directly.
const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

const TRACK = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';
let db: DatabaseSyncType;
let repo: Repository;

const focus = (overrides: Partial<Parameters<Repository['recordFocusSession']>[0]> = {}) =>
  repo.recordFocusSession({
    todoId: null,
    startedAt: 0,
    endedAt: 1,
    plannedMinutes: 25,
    actualMinutes: 25,
    completed: true,
    pauseCount: 0,
    dateKey: '2026-10-15',
    hour: 9,
    ...overrides
  });

beforeEach(() => {
  db = new DatabaseSync(':memory:');
  migrate(db);
  repo = createRepository(db);
});

describe('schema', () => {
  it('migrates once and is idempotent', () => {
    migrate(db);
    expect((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version).toBe(1);
  });
});

describe('todos', () => {
  it('adds trimmed todos in order and rejects blanks', () => {
    repo.addTodo('  개념 정리 ', 2);
    repo.addTodo('문제 풀이');
    expect(repo.addTodo('   ')).toBeNull();

    const todos = repo.listTodos();
    expect(todos.map((t) => [t.title, t.estimate, t.done])).toEqual([
      ['개념 정리', 2, false],
      ['문제 풀이', 1, false]
    ]);
  });

  it('sorts done todos last and records completion time', () => {
    const a = repo.addTodo('a')!;
    repo.addTodo('b');
    repo.setTodoDone(a.id, true);

    const todos = repo.listTodos();
    expect(todos.map((t) => t.title)).toEqual(['b', 'a']);
    expect(todos[1].completedAt).not.toBeNull();
  });

  it('moves a todo up and down among open todos', () => {
    const a = repo.addTodo('a')!;
    repo.addTodo('b');
    repo.addTodo('c');

    repo.moveTodo(a.id, 1);
    expect(repo.listTodos().map((t) => t.title)).toEqual(['b', 'a', 'c']);
    repo.moveTodo(a.id, -5);
    expect(repo.listTodos().map((t) => t.title)).toEqual(['a', 'b', 'c']);
    repo.moveTodo(a.id, -1);
    expect(repo.listTodos().map((t) => t.title)).toEqual(['a', 'b', 'c']);
  });

  it('updates, deletes, and clears completed todos', () => {
    const a = repo.addTodo('a')!;
    const b = repo.addTodo('b')!;
    repo.updateTodo(a.id, { title: 'A', estimate: 99 });
    repo.setTodoDone(b.id, true);
    repo.clearCompletedTodos();

    expect(repo.listTodos()).toMatchObject([{ title: 'A', estimate: 12 }]);
    repo.deleteTodo(a.id);
    expect(repo.listTodos()).toEqual([]);
  });
});

describe('focus sessions', () => {
  it('counts completed sessions toward the linked todo only', () => {
    const todo = repo.addTodo('a')!;
    focus({ todoId: todo.id });
    focus({ todoId: todo.id, completed: false, actualMinutes: 5 });

    expect(repo.listTodos()[0].pomodoros).toBe(1);
  });

  it('aggregates completed minutes per day and per hour', () => {
    focus({ dateKey: '2026-10-14', hour: 9 });
    focus({ dateKey: '2026-10-15', hour: 9 });
    focus({ dateKey: '2026-10-15', hour: 21, actualMinutes: 50 });
    focus({ dateKey: '2026-10-15', completed: false, actualMinutes: 10 });

    expect(repo.getDailyFocus('2026-10-14', '2026-10-15')).toEqual([
      { dateKey: '2026-10-14', minutes: 25, sessions: 1 },
      { dateKey: '2026-10-15', minutes: 75, sessions: 2 }
    ]);
    expect(repo.getHourlyFocus('2026-10-15', '2026-10-15')).toEqual([
      { hour: 9, minutes: 25 },
      { hour: 21, minutes: 50 }
    ]);
  });

  it('summarizes completion, pauses, and average length', () => {
    focus({ pauseCount: 2 });
    focus({ actualMinutes: 35 });
    focus({ completed: false, pauseCount: 1, actualMinutes: 3 });

    expect(repo.getSessionSummary('2026-10-15', '2026-10-15')).toEqual({
      completed: 2,
      abandoned: 1,
      pauses: 3,
      averageMinutes: 30,
      averageMood: null
    });
    expect(repo.getSessionSummary('2020-01-01', '2020-01-02')).toEqual({
      completed: 0,
      abandoned: 0,
      pauses: 0,
      averageMinutes: 0,
      averageMood: null
    });
  });

  it('attaches a reflection note and focus rating to the latest session and lists recent sessions', () => {
    const todo = repo.addTodo('개념 정리')!;
    focus({ endedAt: 1, todoId: todo.id });
    focus({ endedAt: 2 });
    repo.setLastSessionReflection(' 집중 잘 됨 ', 9);

    const recent = repo.listRecentSessions(5);
    expect(recent[0]).toMatchObject({ note: '집중 잘 됨', mood: 5, todoTitle: null });
    expect(recent[1]).toMatchObject({ note: null, mood: null, todoTitle: '개념 정리' });
    expect(repo.getSessionSummary('2026-10-15', '2026-10-15').averageMood).toBe(5);
  });

  it('lists focus records in a date range, newest first, with their todo', () => {
    const todo = repo.addTodo('개념 정리')!;
    focus({ endedAt: 1, dateKey: '2026-10-13', todoId: todo.id });
    focus({ endedAt: 2, dateKey: '2026-10-14', completed: false, actualMinutes: 8 });
    focus({ endedAt: 3, dateKey: '2026-10-15' });

    expect(repo.listSessions('2026-10-14', '2026-10-15').map((s) => [s.dateKey, s.completed, s.minutes])).toEqual([
      ['2026-10-15', true, 25],
      ['2026-10-14', false, 8]
    ]);
    expect(repo.listSessions(null, '2026-10-13')).toMatchObject([{ todoId: todo.id, todoTitle: '개념 정리' }]);
    expect(repo.listSessions('bogus', undefined, 2)).toHaveLength(2);
  });
});

describe('settings and kv', () => {
  it('returns defaults, then persists normalized updates', () => {
    expect(repo.getSettings().focusMinutes).toBe(25);
    repo.updateSettings({ focusMinutes: 50, musicSync: false, bogus: 1 });

    expect(createRepository(db).getSettings()).toMatchObject({ focusMinutes: 50, musicSync: false });
  });

  it('stores and removes key-value strings', () => {
    repo.setKv('snapshot', '{"a":1}');
    expect(repo.getKv('snapshot')).toBe('{"a":1}');
    repo.removeKv('snapshot');
    expect(repo.getKv('snapshot')).toBeNull();
  });
});

describe('playlists', () => {
  it('creates playlists with ordered, validated items', () => {
    const id = repo.createPlaylist('집중용')!;
    expect(repo.addPlaylistItem(id, { player: 'Spotify', ref: TRACK, title: 'Snowman', artist: 'WYS' })).toBe(true);
    expect(repo.addPlaylistItem(id, { player: 'Music', ref: 'A1B2C3D4E5F60718', title: 'Coffee' })).toBe(true);
    expect(repo.addPlaylistItem(id, { player: 'Spotify', ref: 'bad" & quit', title: 'x' })).toBe(false);

    const [playlist] = repo.listPlaylists();
    expect(playlist.name).toBe('집중용');
    expect(playlist.items.map((i) => i.title)).toEqual(['Snowman', 'Coffee']);
  });

  it('stores local audio files and looks items up by id', () => {
    const id = repo.createPlaylist('내 파일')!;
    expect(repo.addPlaylistItem(id, { player: 'Local', ref: '/Users/me/Music/rain.mp3', title: 'rain' })).toBe(true);
    expect(repo.addPlaylistItem(id, { player: 'Local', ref: '/etc/passwd', title: 'x' })).toBe(false);

    const [item] = repo.listPlaylists()[0].items;
    expect(repo.getPlaylistItem(item.id)).toMatchObject({ player: 'Local', ref: '/Users/me/Music/rain.mp3' });
    expect(repo.getPlaylistItem('missing')).toBeNull();
  });

  it('reorders and removes items', () => {
    const id = repo.createPlaylist('p')!;
    repo.addPlaylistItem(id, { player: 'Spotify', ref: TRACK, title: 'a' });
    repo.addPlaylistItem(id, { player: 'Music', ref: 'A1B2C3D4E5F60718', title: 'b' });
    const [first] = repo.listPlaylists()[0].items;

    repo.movePlaylistItem(first.id, 1);
    expect(repo.listPlaylists()[0].items.map((i) => i.title)).toEqual(['b', 'a']);
    repo.removePlaylistItem(first.id);
    expect(repo.listPlaylists()[0].items.map((i) => i.title)).toEqual(['b']);
  });

  it('deleting a playlist removes its items and unassigns it from settings', () => {
    const id = repo.createPlaylist('p')!;
    repo.addPlaylistItem(id, { player: 'Spotify', ref: TRACK, title: 'a' });
    repo.updateSettings({ focusPlaylistId: id });
    repo.deletePlaylist(id);

    expect(repo.listPlaylists()).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM playlist_items').get()).toEqual({ n: 0 });
    expect(repo.getSettings().focusPlaylistId).toBeNull();
  });
});

describe('notes', () => {
  it('creates, edits, pins, searches, and deletes notes', () => {
    const a = repo.createNote('공식 정리', '미분 = 기울기')!;
    const b = repo.createNote('', '오답: 부호 실수')!;
    repo.updateNote(b.id, { pinned: true });

    expect(repo.listNotes().map((n) => n.id)).toEqual([b.id, a.id]);
    expect(repo.listNotes('미분').map((n) => n.id)).toEqual([a.id]);
    expect(repo.listNotes('100%').map((n) => n.id)).toEqual([]);

    repo.updateNote(a.id, { title: '  공식  ', body: 'x' });
    expect(repo.listNotes().find((n) => n.id === a.id)).toMatchObject({ title: '공식', body: 'x', pinned: false });

    repo.deleteNote(a.id);
    expect(repo.listNotes()).toHaveLength(1);
  });

  it('rejects empty notes', () => {
    expect(repo.createNote(' ', ' ')).toBeNull();
  });
});
