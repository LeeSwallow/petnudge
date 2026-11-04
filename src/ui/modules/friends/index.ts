import type { UiModule } from '../module';
import { t } from '../../i18n';
import Friends from './Friends.svelte';

export const friendsUi: UiModule = { id: 'friends', get label() { return t('panel.module.friends'); }, icon: 'happy', group: 'settings', order: 20, component: Friends };
