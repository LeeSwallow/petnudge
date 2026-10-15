import type { TimerMode } from '../../../mobile/src/domain/timer';
import { decideMusicAction, isExternalPlayer, type NowPlaying } from '../shared/music';
import { skipInQueue, startQueue, stepQueue, type QueueState } from '../shared/playlistQueue';
import type { PlaylistItem } from '../shared/types';
import { api } from './api';
import { data, playablePlaylistId } from './data';

// The built-in player (files the user added, streamed via pet-audio://) is the
// default; Spotify / Apple Music stay available as an optional integration.

const audio = new Audio();
audio.preload = 'auto';

let localItem: PlaylistItem | null = null;
let externalNow: NowPlaying | null = null;

const listeners = new Set<() => void>();
export const onMusic = (listener: () => void) => listeners.add(listener);
const emit = () => listeners.forEach((listener) => listener());

const itemsOf = (playlistId: string): PlaylistItem[] => data.playlists.find((p) => p.id === playlistId)?.items ?? [];
const currentQueueItem = () => (music.queue ? itemsOf(music.queue.playlistId)[music.queue.index] ?? null : null);

export const music = {
  queue: null as QueueState | null,

  get nowPlaying(): NowPlaying | null {
    if (localItem) {
      return { player: 'Local', state: audio.paused ? 'paused' : 'playing', ref: localItem.ref, title: localItem.title, artist: localItem.artist };
    }
    return externalNow;
  },

  async toggle() {
    if (localItem) {
      if (audio.paused) await audio.play().catch(() => undefined);
      else audio.pause();
      return;
    }
    if (externalNow && isExternalPlayer(externalNow.player)) {
      await api.controlMusic(externalNow.player, externalNow.state === 'playing' ? 'pause' : 'play');
    }
  },

  async next() {
    if (music.queue) {
      const step = skipInQueue(music.queue, itemsOf(music.queue.playlistId));
      music.queue = step.queue;
      await play(step.play);
    } else if (externalNow && isExternalPlayer(externalNow.player)) {
      await api.controlMusic(externalNow.player, 'next');
    }
    emit();
  },

  setVolume(percent: number) {
    audio.volume = Math.min(1, Math.max(0, percent / 100));
  }
};

const play = async (item: PlaylistItem | null) => {
  if (!item) return;
  if (item.player === 'Local') {
    localItem = item;
    audio.src = `pet-audio://${item.id}`;
    await audio.play().catch(() => undefined);
  } else if (isExternalPlayer(item.player)) {
    stopLocal();
    await api.playItem(item.player, item.ref);
  }
};

const stopLocal = () => {
  audio.pause();
  audio.removeAttribute('src');
  localItem = null;
};

['play', 'pause'].forEach((type) => audio.addEventListener(type, emit));
audio.addEventListener('ended', () => void music.next());
// A missing or unreadable file skips ahead instead of stalling the playlist.
audio.addEventListener('error', () => {
  if (localItem) void music.next();
});

export const playPlaylist = async (playlistId: string) => {
  const step = startQueue(playlistId, itemsOf(playlistId));
  music.queue = step.queue;
  if (!step.queue) stopLocal();
  await play(step.play);
  emit();
};

// Polled state of the external player (macOS). Only drives the queue while
// the queue is on an external item.
export const handleNowPlaying = async (nowPlaying: NowPlaying | null) => {
  externalNow = nowPlaying;
  const item = currentQueueItem();
  if (music.queue && item && item.player !== 'Local') {
    const step = stepQueue(music.queue, itemsOf(music.queue.playlistId), nowPlaying);
    music.queue = step.queue;
    await play(step.play);
  }
  emit();
};

// Called whenever the pomodoro moves between idle / focus / break.
export const handleModeChange = async (previous: TimerMode, next: TimerMode) => {
  const action = decideMusicAction(previous, next, music.nowPlaying, {
    musicSync: data.settings.musicSync,
    focusPlaylistId: playablePlaylistId(data.settings.focusPlaylistId),
    breakPlaylistId: playablePlaylistId(data.settings.breakPlaylistId)
  });
  if (!action) return;
  if (action.type === 'playlist') return playPlaylist(action.playlistId);
  if (localItem) {
    if (action.type === 'play') await audio.play().catch(() => undefined);
    else audio.pause();
  } else if (externalNow && isExternalPlayer(externalNow.player)) {
    music.queue = null;
    await api.controlMusic(externalNow.player, action.type);
  }
  emit();
};
