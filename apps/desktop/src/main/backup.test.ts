import { beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { createRepository, type Repository } from './db/repository';
import { migrate } from './db/schema';
import { BACKUP_FORMAT, createBackup, isPortableKv, parseBackup, restoreBackup, summarizeBackup } from './backup';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

const TRACK = 'spotify:track:4uLU6hMCjMI75M1A2tKUQC';

const fresh = () => {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  return { db, repo: createRepository(db) };
};

let db: DatabaseSyncType;
let repo: Repository;

const seed = () => {
  const todo = repo.addTodo('영어 단어', 3)!;
  repo.addTodo('수학 문제');
  repo.setTodoDone(todo.id, true);
  repo.createNote('공식', '미분 = 기울기');
  const pinned = repo.createNote('고정 메모', '')!;
  repo.updateNote(pinned.id, { pinned: true });
  repo.recordFocusSession({
    todoId: todo.id, startedAt: 1_000, endedAt: 2_000, plannedMinutes: 25, actualMinutes: 25,
    completed: true, pauseCount: 1, dateKey: '2026-10-14', hour: 9
  });
  repo.setLastSessionReflection('잘 됐어', 4);
  repo.recordFocusSession({
    todoId: null, startedAt: 3_000, endedAt: 4_000, plannedMinutes: 25, actualMinutes: 7,
    completed: false, pauseCount: 0, dateKey: '2026-10-15', hour: 10
  });
  const playlist = repo.createPlaylist('집중')!;
  repo.addPlaylistItem(playlist, { player: 'Spotify', ref: TRACK, title: 'Lofi', artist: 'A' });
  repo.updateSettings({ focusMinutes: 50, nickname: '민', focusPlaylistId: playlist });
  repo.setKv('ui.module', 'notes');
  repo.setKv('mcp.token', 'super-secret');
  repo.setKv('openai.apiKey', 'sk-123');
  repo.setKv('pet.anchor', '{"x":1,"y":2}');
  repo.setKv('session', JSON.stringify({ state: { progress: { exp: 120 }, timer: { mode: 'focus', endsAt: 1 } }, version: 1 }));
};

beforeEach(() => {
  ({ db, repo } = fresh());
  seed();
});

describe('backup', () => {
  it('exports user data and leaves secrets and device state out', () => {
    const backup = createBackup(db, '0.1.0', new Date('2026-10-15T00:00:00Z'));

    expect(backup).toMatchObject({ format: BACKUP_FORMAT, appVersion: '0.1.0', exportedAt: '2026-10-15T00:00:00.000Z' });
    expect(summarizeBackup(backup)).toMatchObject({ todos: 2, notes: 2, sessions: 2, playlists: 1 });
    expect(backup.sessions[0]).toMatchObject({ note: '잘 됐어', mood: 4, completed: true, pauseCount: 1 });
    expect(backup.playlists[0].items).toMatchObject([{ ref: TRACK, title: 'Lofi' }]);
    expect(backup.settings).toMatchObject({ focusMinutes: 50, nickname: '민' });
    expect(Object.keys(backup.kv).sort()).toEqual(['session', 'ui.module']);
    expect(JSON.stringify(backup)).not.toContain('secret');
    expect(JSON.stringify(backup)).not.toContain('sk-123');
  });

  it('flags secret-looking keys conservatively', () => {
    for (const key of ['mcp.token', 'apiKey', 'my.secret', 'key.openai', 'claude.key', 'authHeader']) expect(isPortableKv(key)).toBe(false);
    for (const key of ['session', 'ui.module', 'filter.notes', 'mods.disabled']) expect(isPortableKv(key)).toBe(true);
  });

  it('round-trips through JSON into another database', () => {
    const backup = parseBackup(JSON.stringify(createBackup(db, '0.1.0')));
    const target = fresh();
    target.repo.addTodo('지워질 할 일');
    target.repo.setKv('mcp.token', 'target-secret');
    target.repo.setKv('session', JSON.stringify({ state: { progress: { exp: 0 }, timer: { mode: 'idle' } }, version: 1 }));

    const session = restoreBackup(target.db, backup);

    expect(target.repo.listTodos().map((t) => t.title)).toEqual(['수학 문제', '영어 단어']);
    expect(target.repo.listTodos().find((t) => t.done)).toMatchObject({ title: '영어 단어', pomodoros: 1 });
    expect(target.repo.listNotes().map((n) => [n.title, n.pinned])).toEqual([['고정 메모', true], ['공식', false]]);
    expect(target.repo.listRecentSessions(10)).toMatchObject([
      { completed: false, minutes: 7, todoTitle: null },
      { completed: true, note: '잘 됐어', mood: 4, todoTitle: '영어 단어' }
    ]);
    expect(target.repo.getSessionSummary('2026-10-01', '2026-10-31')).toMatchObject({ completed: 1, abandoned: 1 });
    expect(target.repo.listPlaylists()[0]).toMatchObject({ name: '집중', items: [{ ref: TRACK }] });
    expect(target.repo.getSettings()).toMatchObject({ focusMinutes: 50, nickname: '민', focusPlaylistId: target.repo.listPlaylists()[0].id });
    // This machine's secrets survive; the imported progress arrives but the live timer stays local.
    expect(target.repo.getKv('mcp.token')).toBe('target-secret');
    expect(target.repo.getKv('ui.module')).toBe('notes');
    expect(JSON.parse(session!)).toEqual({ state: { progress: { exp: 120 }, timer: { mode: 'idle' } }, version: 1 });
  });

  it('rejects files that are not valid backups with readable messages', () => {
    expect(() => parseBackup('{oops')).toThrow('JSON 파일을 읽지 못했어요');
    expect(() => parseBackup(JSON.stringify({ format: 'other' }))).toThrow('백업 파일이 아니에요');
    const broken = { ...createBackup(db, '0.1.0'), todos: [{ id: 'x', title: 1 }] };
    expect(() => parseBackup(JSON.stringify(broken))).toThrow('todos.0');
  });

  it('changes nothing when the restore fails part-way', () => {
    const backup = createBackup(db, '0.1.0');
    const duplicate = { ...backup, notes: [...backup.notes, backup.notes[0]] };
    const target = fresh();
    target.repo.addTodo('그대로 있어야 해요');

    expect(() => restoreBackup(target.db, duplicate)).toThrow('가져오지 못했어요');
    expect(target.repo.listTodos().map((t) => t.title)).toEqual(['그대로 있어야 해요']);
  });
});
