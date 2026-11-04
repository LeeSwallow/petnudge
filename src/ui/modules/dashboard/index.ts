import type { UiModule } from '../module';
import { t } from '../../i18n';
import Dashboard from './Dashboard.svelte';

export const dashboardUi: UiModule = { id: 'dashboard', get label() { return t('panel.module.dashboard'); }, icon: 'chart', group: 'record', order: 20, component: Dashboard };
