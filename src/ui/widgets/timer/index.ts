import type { Widget } from '../widget';
import { t } from '../../i18n';
import TimerWidget from './TimerWidget.svelte';

export const timerWidget: Widget = { id: 'timer', get label() { return t('widgets.timer.title'); }, size: 2, component: TimerWidget };
