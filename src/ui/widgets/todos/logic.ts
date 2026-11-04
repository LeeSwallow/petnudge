import type { Todo } from '../../../shared/types';

// The todo summary widget's view, apart from the screen and from whose list
// it is (tested in logic.test.ts).

export type TodosSource = { todos: readonly Todo[]; activeTodoId: string | null };

export const todosView = ({ todos, activeTodoId }: TodosSource) => ({
  done: todos.filter((t) => t.done).length,
  total: todos.length,
  active: todos.find((t) => t.id === activeTodoId)?.title ?? null,
  empty: todos.length === 0
});
