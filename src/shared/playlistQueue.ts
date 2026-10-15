import { isContextRef, type NowPlaying } from './music';
import type { PlaylistItem } from './types';

// The app plays its own playlists one track at a time through the external
// player and advances when the player moves on to something else.
export type QueueState = {
  playlistId: string;
  index: number;
  // The player has been seen playing the current item.
  confirmed: boolean;
  // Polls spent waiting for the player to pick up the current item.
  waitPolls: number;
};

export const MAX_WAIT_POLLS = 5;

type Step = { queue: QueueState | null; play: PlaylistItem | null };

export const startQueue = (playlistId: string, items: PlaylistItem[]): Step => {
  if (items.length === 0) return { queue: null, play: null };
  return { queue: { playlistId, index: 0, confirmed: false, waitPolls: 0 }, play: items[0] };
};

const advance = (queue: QueueState, items: PlaylistItem[]): Step => {
  const index = (queue.index + 1) % items.length;
  return { queue: { ...queue, index, confirmed: false, waitPolls: 0 }, play: items[index] };
};

export const skipInQueue = (queue: QueueState | null, items: PlaylistItem[]): Step =>
  queue && items.length > 0 ? advance(queue, items) : { queue, play: null };

export const stepQueue = (queue: QueueState | null, items: PlaylistItem[], nowPlaying: NowPlaying | null): Step => {
  if (!queue || items.length === 0) return { queue: null, play: null };
  const current = items[Math.min(queue.index, items.length - 1)];

  // Albums/playlists keep playing inside the player on their own.
  if (isContextRef(current.ref)) return { queue, play: null };

  if (nowPlaying?.ref === current.ref) {
    return { queue: queue.confirmed ? queue : { ...queue, confirmed: true, waitPolls: 0 }, play: null };
  }

  if (!queue.confirmed) {
    const waitPolls = queue.waitPolls + 1;
    // The item never started (removed from library, region locked…): skip it.
    return waitPolls >= MAX_WAIT_POLLS ? advance(queue, items) : { queue: { ...queue, waitPolls }, play: null };
  }

  // The player was closed: stop rather than relaunching it.
  if (!nowPlaying) return { queue: null, play: null };
  return advance(queue, items);
};
