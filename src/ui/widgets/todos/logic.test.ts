import { describe, expect, it } from 'vitest';
import type { Todo } from '../../../shared/types';
import { todosView } from './logic';

const todo = (id: string, title: string, done = false): Todo => ({ id, title, done, estimate: 1, pomodoros: 0, position: 0, createdAt: 0, completedAt: done ? 1 : null });

describe('todo summary widget', () => {
  it('counts done of all and names the active todo', () => {
    const todos = [todo('a', '영어', true), todo('b', '수학'), todo('c', '과학')];
    expect(todosView({ todos, activeTodoId: 'c' })).toEqual({ done: 1, total: 3, active: '과학', empty: false });
  });

  it('has no active todo when none is chosen or it is gone', () => {
    expect(todosView({ todos: [todo('a', '영어')], activeTodoId: null }).active).toBeNull();
    expect(todosView({ todos: [todo('a', '영어')], activeTodoId: 'ghost' }).active).toBeNull();
  });

  it('is empty without todos', () => {
    expect(todosView({ todos: [], activeTodoId: null })).toEqual({ done: 0, total: 0, active: null, empty: true });
  });
});
