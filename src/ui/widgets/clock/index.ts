import type { Widget } from '../widget';
import { t } from '../../i18n';
import ClockWidget from './ClockWidget.svelte';

// Not on the default board: the user adds it from "+ 위젯 추가".
export const clockWidget: Widget = { id: 'clock', get label() { return t('widgets.clock.title'); }, size: 2, component: ClockWidget };
