import type { UiModule } from '../module';
import Chat from './Chat.svelte';

export const chatUi: UiModule = { id: 'chat', label: '대화', icon: 'talk', component: Chat };
export { showActiveSession } from './view.svelte';
