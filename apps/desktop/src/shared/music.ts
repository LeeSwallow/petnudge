import type { TimerMode } from '../../../mobile/src/domain/timer';

// External players are controlled over AppleScript (macOS); 'Local' is the
// app's own audio player for files the user added.
export const EXTERNAL_PLAYERS = ['Spotify', 'Music'] as const;
export type ExternalPlayer = (typeof EXTERNAL_PLAYERS)[number];
export type PlayerName = ExternalPlayer | 'Local';

export type NowPlaying = {
  player: PlayerName;
  state: 'playing' | 'paused';
  // Spotify URI or Apple Music persistent ID of the current track.
  ref: string;
  title: string;
  artist: string;
};

export type MusicAction = { type: 'play' } | { type: 'pause' } | { type: 'playlist'; playlistId: string };

export const isExternalPlayer = (value: unknown): value is ExternalPlayer =>
  typeof value === 'string' && (EXTERNAL_PLAYERS as readonly string[]).includes(value);

export const isSupportedPlayer = (value: unknown): value is PlayerName => value === 'Local' || isExternalPlayer(value);

const SPOTIFY_URI = /^spotify:(track|album|playlist|episode):[A-Za-z0-9]{10,40}$/;
const MUSIC_PERSISTENT_ID = /^[0-9A-F]{16}$/;
const AUDIO_FILE = /^(\/|[A-Za-z]:\\).+\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i;

// External refs are interpolated into AppleScript and local refs are opened
// from disk, so only these exact shapes are allowed.
export const isValidMusicRef = (player: PlayerName, ref: unknown): ref is string => {
  if (typeof ref !== 'string' || ref.length > 1024) return false;
  if (player === 'Spotify') return SPOTIFY_URI.test(ref);
  if (player === 'Music') return MUSIC_PERSISTENT_ID.test(ref);
  return AUDIO_FILE.test(ref);
};

// Album/playlist refs play as a whole in the player instead of track by track.
export const isContextRef = (ref: string): boolean => /^spotify:(album|playlist):/.test(ref);

// Accepts open.spotify.com share links (with or without a locale segment) and spotify: URIs.
export const parseMusicLink = (input: string): { player: PlayerName; ref: string; kind: string } | null => {
  const text = input.trim();
  const uri = text.match(/^spotify:(track|album|playlist|episode):([A-Za-z0-9]+)$/);
  const url = text.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(track|album|playlist|episode)\/([A-Za-z0-9]+)/);
  const match = uri ?? url;
  if (!match) return null;
  const ref = `spotify:${match[1]}:${match[2]}`;
  return isValidMusicRef('Spotify', ref) ? { player: 'Spotify', ref, kind: match[1] } : null;
};

// Parses one line of `player\tstate\tref\ttitle\tartist` emitted by the player scripts.
export const parseNowPlaying = (output: string): NowPlaying | null => {
  const [player, state, ref, title, ...artistParts] = output.replace(/\r?\n$/, '').split('\t');
  if (!isExternalPlayer(player) || title === undefined || ref === undefined) return null;
  if (state !== 'playing' && state !== 'paused') return null;
  return { player, state, ref, title, artist: artistParts.join('\t') };
};

export const pickNowPlaying = (candidates: (NowPlaying | null)[]): NowPlaying | null => {
  const open = candidates.filter((item): item is NowPlaying => item !== null);
  return open.find((item) => item.state === 'playing') ?? open[0] ?? null;
};

export type MusicSyncSettings = {
  musicSync: boolean;
  // Only set when the playlist exists and has items.
  focusPlaylistId: string | null;
  breakPlaylistId: string | null;
};

// Music follows the pomodoro: a mode's playlist starts with it; without one,
// paused music resumes when focus begins and pauses when the break begins.
export const decideMusicAction = (
  previousMode: TimerMode,
  nextMode: TimerMode,
  nowPlaying: NowPlaying | null,
  settings: MusicSyncSettings
): MusicAction | null => {
  if (!settings.musicSync || previousMode === nextMode) return null;
  if (nextMode === 'focus') {
    if (settings.focusPlaylistId) return { type: 'playlist', playlistId: settings.focusPlaylistId };
    return nowPlaying?.state === 'paused' ? { type: 'play' } : null;
  }
  if (previousMode === 'focus' && nextMode === 'break') {
    if (settings.breakPlaylistId) return { type: 'playlist', playlistId: settings.breakPlaylistId };
    return nowPlaying?.state === 'playing' ? { type: 'pause' } : null;
  }
  return null;
};
