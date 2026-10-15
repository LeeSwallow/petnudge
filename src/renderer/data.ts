import { toDateKey } from '../domain/progress/progress';
import { defaultSettings, type AppSettings } from '../shared/settings';
import { lastDateKeys, shiftDateKey } from '../shared/stats';
import type { DailyFocus, HourlyFocus, Note, Playlist, Todo } from '../shared/types';
import { api } from './api';

// Renderer-side cache of what lives in SQLite. Modules read from `data` and
// call `refresh*` after writing; listeners re-render on change.

type Summary = Awaited<ReturnType<typeof api.db.getSessionSummary>>;
type RecentSession = Awaited<ReturnType<typeof api.db.listRecentSessions>>[number];

export const STATS_WEEKS = 5;

export const data = {
  todos: [] as Todo[],
  notes: [] as Note[],
  noteQuery: '',
  playlists: [] as Playlist[],
  settings: defaultSettings as AppSettings,
  todayKey: toDateKey(new Date()),
  daily: [] as DailyFocus[],
  hourly: [] as HourlyFocus[],
  summary7: { completed: 0, abandoned: 0, pauses: 0, averageMinutes: 0, averageMood: null } as Summary,
  recent: [] as RecentSession[]
};

export type DataKind = 'todos' | 'notes' | 'playlists' | 'settings' | 'stats';
const listeners = new Set<(kind: DataKind) => void>();

export const onData = (listener: (kind: DataKind) => void) => listeners.add(listener);
const emit = (kind: DataKind) => listeners.forEach((listener) => listener(kind));

export const refreshTodos = async () => {
  data.todos = await api.db.listTodos();
  emit('todos');
};

export const refreshNotes = async () => {
  data.notes = await api.db.listNotes(data.noteQuery);
  emit('notes');
};

export const refreshPlaylists = async () => {
  data.playlists = await api.db.listPlaylists();
  emit('playlists');
};

export const refreshSettings = async () => {
  data.settings = await api.db.getSettings();
  emit('settings');
};

export const updateSettings = async (patch: Partial<AppSettings>) => {
  data.settings = await api.db.updateSettings(patch);
  emit('settings');
};

export const refreshStats = async () => {
  data.todayKey = toDateKey(new Date());
  const from = shiftDateKey(data.todayKey, -(STATS_WEEKS * 7 + 6));
  const weekFrom = lastDateKeys(data.todayKey, 7)[0];
  const [daily, hourly, summary7, recent] = await Promise.all([
    api.db.getDailyFocus(from, data.todayKey),
    api.db.getHourlyFocus(shiftDateKey(data.todayKey, -29), data.todayKey),
    api.db.getSessionSummary(weekFrom, data.todayKey),
    api.db.listRecentSessions(6)
  ]);
  Object.assign(data, { daily, hourly, summary7, recent });
  emit('stats');
};

export const refreshAll = () =>
  Promise.all([refreshSettings(), refreshTodos(), refreshNotes(), refreshPlaylists(), refreshStats()]);

// Playlist ids for music sync, only when they exist and have items.
export const playablePlaylistId = (id: string | null) =>
  id && data.playlists.some((p) => p.id === id && p.items.length > 0) ? id : null;
