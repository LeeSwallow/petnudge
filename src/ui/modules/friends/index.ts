import type { UiModule } from '../module';
import Friends from './Friends.svelte';

export const friendsUi: UiModule = { id: 'friends', label: '캐릭터', icon: 'happy', group: 'settings', order: 20, component: Friends };
