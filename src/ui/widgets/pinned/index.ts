import type { Widget } from '../widget';
import { t } from '../../i18n';
import PinnedWidget from './PinnedWidget.svelte';

export const pinnedWidget: Widget = { id: 'pinned', get label() { return t('widgets.pinned.title'); }, size: 1, component: PinnedWidget };
