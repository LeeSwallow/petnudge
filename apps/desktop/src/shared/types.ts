import type { PlayerName } from './music';

export type Todo = {
  id: string;
  title: string;
  done: boolean;
  // Pomodoros the user expects this todo to take, and how many it has had.
  estimate: number;
  pomodoros: number;
  position: number;
  createdAt: number;
  completedAt: number | null;
};

export type FocusSessionRecord = {
  id: string;
  todoId: string | null;
  startedAt: number;
  endedAt: number;
  plannedMinutes: number;
  completed: boolean;
  // Local calendar date (YYYY-MM-DD) and hour the session ended in.
  dateKey: string;
  hour: number;
};

export type DailyFocus = { dateKey: string; minutes: number; sessions: number };
export type HourlyFocus = { hour: number; minutes: number };

export type PlaylistItem = {
  id: string;
  playlistId: string;
  player: PlayerName;
  // Spotify URI (spotify:track:…) or Apple Music persistent ID.
  ref: string;
  title: string;
  artist: string;
  position: number;
};

export type Playlist = { id: string; name: string; createdAt: number; items: PlaylistItem[] };

export type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
};
