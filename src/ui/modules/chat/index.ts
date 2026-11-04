import type { UiModule } from '../module';
import { t } from '../../i18n';
import Chat from './Chat.svelte';

export const chatUi: UiModule = { id: 'chat', get label() { return t('panel.module.chat'); }, icon: 'talk', group: 'record', order: 30, component: Chat };
export { showActiveSession, showSession } from './view.svelte';
