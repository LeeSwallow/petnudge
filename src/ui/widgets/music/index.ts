import type { Widget } from '../widget';
import { t } from '../../i18n';
import { myMusic } from './feed';
import MusicWidget from './MusicWidget.svelte';

// Nothing playing: the dock leaves it out, as the old now-playing strip hid.
export const musicWidget: Widget = { id: 'music', get label() { return t('widgets.music.title'); }, size: 2, component: MusicWidget, quiet: () => myMusic.read().track === null };
