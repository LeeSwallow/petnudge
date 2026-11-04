import type { Playlist } from '../../../shared/types';

// The music tab's rules, apart from the screen (tested in logic.test.ts).

export type SourceKind = 'local' | 'spotify' | 'music';
export const sourceKind = (player: string): SourceKind => (player === 'Local' ? 'local' : player === 'Spotify' ? 'spotify' : 'music');

// The chosen list, else the first one (after a delete), else none.
export const selectedList = (playlists: Playlist[], id: string | null) => playlists.find((p) => p.id === id) ?? playlists[0] ?? null;

// A file added from disk: its name without the extension, "내 파일" as artist.
export const localTrack = (path: string) => {
  const name = path.split(/[\\/]/).pop() ?? path;
  return { player: 'Local', ref: path, title: name.replace(/\.[^.]+$/, ''), artist: '내 파일' };
};

export const addedText = (added: number) => (added ? `${added}곡 추가했어요` : '지원하는 음악 파일이 없어요');
