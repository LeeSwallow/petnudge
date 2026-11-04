import type { Widget } from '../widget';
import { t } from '../../i18n';
import TodosWidget from './TodosWidget.svelte';

export const todosWidget: Widget = { id: 'todos', get label() { return t('widgets.todos.title'); }, size: 1, component: TodosWidget };
