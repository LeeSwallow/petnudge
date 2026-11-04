import type { UiModule } from '../module';
import Dashboard from './Dashboard.svelte';

export const dashboardUi: UiModule = { id: 'dashboard', label: '대시보드', icon: 'chart', group: 'record', order: 20, component: Dashboard };
