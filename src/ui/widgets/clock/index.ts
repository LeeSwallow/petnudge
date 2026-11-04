import type { Widget } from '../widget';
import ClockWidget from './ClockWidget.svelte';

// Not on the default board: the user adds it from "+ 위젯 추가".
export const clockWidget: Widget = { id: 'clock', label: '시계', size: 2, component: ClockWidget };
