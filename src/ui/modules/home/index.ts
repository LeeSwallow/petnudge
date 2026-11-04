import type { UiModule } from '../module';
import Home from './Home.svelte';

export const homeUi: UiModule = { id: 'home', label: '위젯 보드', icon: 'home', group: 'home', order: 10, component: Home };
