import { describe, expect, it } from 'vitest';
import type { NowPlaying } from './music';
import { MAX_WAIT_POLLS, skipInQueue, startQueue, stepQueue } from './playlistQueue';
import type { PlaylistItem } from './types';

const item = (n: number, ref = `spotify:track:track${String(n).padStart(10, '0')}`): PlaylistItem => ({
  id: `i${n}`,
  playlistId: 'p',
  player: 'Spotify',
  ref,
  title: `T${n}`,
  artist: '',
  position: n
});
const items = [item(0), item(1)];
const playing = (ref: string): NowPlaying => ({ player: 'Spotify', state: 'playing', ref, title: '', artist: '' });

describe('playlistQueue', () => {
  it('starts at the first item, or not at all for an empty playlist', () => {
    expect(startQueue('p', items).play).toBe(items[0]);
    expect(startQueue('p', [])).toEqual({ queue: null, play: null });
  });

  it('confirms once the player is on the current item and then waits', () => {
    let { queue } = startQueue('p', items);
    ({ queue } = stepQueue(queue, items, playing(items[0].ref)));

    expect(queue?.confirmed).toBe(true);
    expect(stepQueue(queue, items, playing(items[0].ref)).play).toBeNull();
  });

  it('advances and wraps when the player moves on after confirming', () => {
    let { queue } = startQueue('p', items);
    ({ queue } = stepQueue(queue, items, playing(items[0].ref)));
    let step = stepQueue(queue, items, playing('spotify:track:somethingelse00'));
    expect(step.play).toBe(items[1]);

    ({ queue } = stepQueue(step.queue, items, playing(items[1].ref)));
    step = stepQueue(queue, items, playing('spotify:track:somethingelse00'));
    expect(step.play).toBe(items[0]);
  });

  it('skips an item the player never picks up', () => {
    let step = startQueue('p', items);
    for (let i = 0; i < MAX_WAIT_POLLS - 1; i += 1) {
      step = stepQueue(step.queue, items, null);
      expect(step.play).toBeNull();
    }
    expect(stepQueue(step.queue, items, null).play).toBe(items[1]);
  });

  it('stops when the player closes after confirming', () => {
    let { queue } = startQueue('p', items);
    ({ queue } = stepQueue(queue, items, playing(items[0].ref)));

    expect(stepQueue(queue, items, null)).toEqual({ queue: null, play: null });
  });

  it('lets album and playlist items run inside the player', () => {
    const context = [item(0, 'spotify:playlist:37i9dQZF1DWWQRwui0ExPn'), item(1)];
    const { queue } = startQueue('p', context);

    expect(stepQueue(queue, context, playing('spotify:track:other00000000')).play).toBeNull();
  });

  it('skips to the next item on demand', () => {
    const { queue } = startQueue('p', items);

    expect(skipInQueue(queue, items).play).toBe(items[1]);
  });
});
