import type { UiModule } from '../module';
import Chat from './Chat.svelte';

export const chatUi: UiModule = { id: 'chat', label: '대화', icon: 'talk', group: 'record', order: 30, component: Chat };
export { showActiveSession, showSession } from './view.svelte';
