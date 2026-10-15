import { describe, expect, it } from 'vitest';
import { createEmoter } from './emoter';

const emotes = { actions: ['happy', 'love', 'huh'], everyMs: [1000, 3000] as [number, number] };

describe('emoter', () => {
  it('waits a random while, then plays a random emote and schedules the next', () => {
    const emoter = createEmoter(() => 0.5); // wait 2000ms, pick index 1
    expect(emoter.tick(0, true, emotes)).toBeUndefined();
    expect(emoter.tick(1999, true, emotes)).toBeUndefined();
    expect(emoter.tick(2000, true, emotes)).toBe('love');
    expect(emoter.tick(2001, true, emotes)).toBeUndefined();
    expect(emoter.tick(4000, true, emotes)).toBe('love');
  });

  it('waits again after being busy past its time, and does nothing without emotes', () => {
    const emoter = createEmoter(() => 0);
    emoter.tick(0, true, emotes);
    expect(emoter.tick(5000, false, emotes)).toBeUndefined(); // busy: reschedule to 6000
    expect(emoter.tick(5500, true, emotes)).toBeUndefined();
    expect(emoter.tick(6000, true, emotes)).toBe('happy');
    expect(createEmoter().tick(0, true, undefined)).toBeUndefined();
  });
});
