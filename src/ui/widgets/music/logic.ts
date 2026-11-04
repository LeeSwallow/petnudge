import type { NowPlaying } from '../../../shared/music';
import { t } from '../../i18n';

// The music widget's view, apart from the screen and from whose player it is
// (tested in logic.test.ts). listName is the playlist playing, if any.

export type MusicSource = { track: NowPlaying | null; listName: string | null };

export const emptyText = () => t('widgets.music.empty');

export const musicView = ({ track, listName }: MusicSource) =>
  track === null
    ? null
    : {
        title: track.title,
        subtitle: [track.artist, listName].filter((s): s is string => !!s).join(' · '),
        playing: track.state === 'playing'
      };
