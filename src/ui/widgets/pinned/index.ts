import type { Widget } from '../widget';
import PinnedWidget from './PinnedWidget.svelte';

export const pinnedWidget: Widget = { id: 'pinned', label: '고정 메모', size: 1, component: PinnedWidget };
