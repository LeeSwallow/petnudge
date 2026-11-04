import type { UiModule } from '../module';
import { t } from '../../i18n';
import Todo from './Todo.svelte';

export const todoUi: UiModule = { id: 'todo', get label() { return t('panel.module.todo'); }, icon: 'pencil', group: 'focus', order: 10, component: Todo };
