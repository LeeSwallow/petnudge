import type { Widget } from '../widget';
import MusicWidget from './MusicWidget.svelte';

export const musicWidget: Widget = { id: 'music', label: '음악', size: 2, component: MusicWidget };
