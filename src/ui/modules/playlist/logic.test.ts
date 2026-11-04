import { describe, expect, it } from 'vitest';
import { addedText, localTrack, selectedList, sourceKind } from './logic';

const lists = [{ id: 'a', name: '집중', items: [] }, { id: 'b', name: '휴식', items: [] }] as never[];

describe('playlist logic', () => {
  it('names where a track comes from', () => {
    expect(sourceKind('Local')).toBe('local');
    expect(sourceKind('Spotify')).toBe('spotify');
    expect(sourceKind('Music')).toBe('music');
  });

  it('falls back to the first list when the chosen one is gone', () => {
    expect(selectedList(lists, 'b')).toBe(lists[1]);
    expect(selectedList(lists, 'ghost')).toBe(lists[0]);
    expect(selectedList([], null)).toBeNull();
  });

  it('turns a file path into a local track', () => {
    expect(localTrack('/Users/me/Music/lofi beat.mp3')).toEqual({ player: 'Local', ref: '/Users/me/Music/lofi beat.mp3', title: 'lofi beat', artist: '내 파일' });
    expect(localTrack('C:\\music\\rain.flac').title).toBe('rain');
  });

  it('says how many files were added', () => {
    expect(addedText(3)).toBe('3곡 추가했어요');
    expect(addedText(0)).toBe('지원하는 음악 파일이 없어요');
  });
});
