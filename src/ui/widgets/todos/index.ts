import type { Widget } from '../widget';
import TodosWidget from './TodosWidget.svelte';

export const todosWidget: Widget = { id: 'todos', label: '할 일 요약', size: 1, component: TodosWidget };
