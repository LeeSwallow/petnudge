import type { RepositoryMethod } from '../main/db/repository';

// Runtime list of repository methods the renderer may call over IPC. The
// `satisfies` check plus the exhaustiveness check below keep it in sync with
// the repository.
export const DB_METHODS = [
  'listTodos',
  'addTodo',
  'updateTodo',
  'setTodoDone',
  'deleteTodo',
  'moveTodo',
  'clearCompletedTodos',
  'recordFocusSession',
  'setLastSessionReflection',
  'getDailyFocus',
  'getHourlyFocus',
  'getSessionSummary',
  'listRecentSessions',
  'listSessions',
  'getSettings',
  'updateSettings',
  'getKv',
  'setKv',
  'removeKv',
  'listNotes',
  'createNote',
  'updateNote',
  'deleteNote',
  'listPlaylists',
  'createPlaylist',
  'renamePlaylist',
  'deletePlaylist',
  'addPlaylistItem',
  'getPlaylistItem',
  'removePlaylistItem',
  'movePlaylistItem'
] as const satisfies readonly RepositoryMethod[];

type Missing = Exclude<RepositoryMethod, (typeof DB_METHODS)[number]>;
export const assertAllDbMethodsListed: Missing extends never ? true : Missing = true;

export const isDbMethod = (value: unknown): value is RepositoryMethod =>
  typeof value === 'string' && (DB_METHODS as readonly string[]).includes(value);
