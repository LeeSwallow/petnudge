import type { UiModule } from '../module';
import Todo from './Todo.svelte';

export const todoUi: UiModule = { id: 'todo', label: '할 일', icon: 'pencil', group: 'focus', order: 10, component: Todo };
