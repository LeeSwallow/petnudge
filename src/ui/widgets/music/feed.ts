import { data } from '../../../renderer/data';
import { music } from '../../../renderer/music';
import type { MusicSource } from './logic';

// Where a music widget reads what plays, and whether it may play or pause it.
export type MusicFeed = { read: () => MusicSource; toggle?: () => void };

export const myMusic: MusicFeed = {
  read: () => ({
    track: music.nowPlaying,
    listName: music.queue ? data.playlists.find((p) => p.id === music.queue!.playlistId)?.name ?? null : null
  }),
  toggle: () => void music.toggle()
};
