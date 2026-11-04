import type { UiModule } from '../module';
import Settings from './Settings.svelte';

export const settingsUi: UiModule = { id: 'settings', label: '설정', icon: 'gear', group: 'settings', order: 10, component: Settings };
