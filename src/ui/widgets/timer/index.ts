import type { Widget } from '../widget';
import TimerWidget from './TimerWidget.svelte';

export const timerWidget: Widget = { id: 'timer', label: '타이머', size: 2, component: TimerWidget };
