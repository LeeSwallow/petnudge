import type { Widget } from '../widget';
import { myMusic } from './feed';
import MusicWidget from './MusicWidget.svelte';

// Nothing playing: the dock leaves it out, as the old now-playing strip hid.
export const musicWidget: Widget = { id: 'music', label: '음악', size: 2, component: MusicWidget, quiet: () => myMusic.read().track === null };
