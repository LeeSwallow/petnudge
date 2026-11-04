import { describe, expect, it } from 'vitest';
import { musicView } from './logic';

const track = { player: 'Local' as const, state: 'playing' as const, ref: '/a.mp3', title: '비', artist: '내 파일' };

describe('music widget', () => {
  it('shows the playing track and offers to pause', () => {
    expect(musicView({ track, listName: '집중 음악' })).toEqual({ title: '비', subtitle: '내 파일 · 집중 음악', playing: true });
  });

  it('offers to play a paused track, without a list name when none plays', () => {
    expect(musicView({ track: { ...track, state: 'paused' }, listName: null })).toEqual({ title: '비', subtitle: '내 파일', playing: false });
  });

  it('is empty when nothing plays', () => {
    expect(musicView({ track: null, listName: null })).toBeNull();
  });
});
