import type { UiModule } from '../module';
import { t } from '../../i18n';
import Settings from './Settings.svelte';

export const settingsUi: UiModule = { id: 'settings', get label() { return t('panel.module.settings'); }, icon: 'gear', group: 'settings', order: 10, component: Settings };
