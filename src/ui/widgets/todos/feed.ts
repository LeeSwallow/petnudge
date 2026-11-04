import { data } from '../../../renderer/data';
import { petStore } from '../../../renderer/store';
import type { TodosSource } from './logic';

// Where a todo summary widget reads its list (the pet's own, or later a friend's).
export type TodosFeed = { read: () => TodosSource };

export const myTodos: TodosFeed = {
  read: () => ({ todos: data.todos, activeTodoId: petStore.getState().activeTodoId })
};
