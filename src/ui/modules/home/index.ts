import type { UiModule } from '../module';
import { t } from '../../i18n';
import Home from './Home.svelte';

export const homeUi: UiModule = { id: 'home', get label() { return t('panel.module.home'); }, icon: 'home', group: 'home', order: 10, component: Home };
