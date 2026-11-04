import { data } from '../../../renderer/data';
import { music } from '../../../renderer/music';
import type { MusicSource } from './logic';

// Where a music widget reads what plays, and whether it may play, pause or
// skip it.
export type MusicFeed = { read: () => MusicSource; toggle?: () => void; next?: () => void };

export const myMusic: MusicFeed = {
  read: () => ({
    track: music.nowPlaying,
    listName: music.queue ? data.playlists.find((p) => p.id === music.queue!.playlistId)?.name ?? null : null
  }),
  toggle: () => void music.toggle(),
  next: () => void music.next()
};
