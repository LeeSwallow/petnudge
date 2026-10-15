import { describe, expect, it } from 'vitest';
import {
  MAX_TODOS,
  addTodo,
  adjustFocusMinutes,
  createEmptyPlannerState,
  removeTodo,
  setGoal,
  toggleTodo
} from './planner';

describe('planner', () => {
  it('starts empty with a default 25/5 pomodoro', () => {
    const planner = createEmptyPlannerState();

    expect(planner.todos).toEqual([]);
    expect(planner.timer).toEqual({ focusMinutes: 25, breakMinutes: 5 });
  });

  it('adds trimmed todos up to the MVP limit of three', () => {
    let planner = createEmptyPlannerState();
    planner = addTodo(planner, '  개념 정리  ', 'a');
    planner = addTodo(planner, '문제 풀이', 'b');
    planner = addTodo(planner, '오답 노트', 'c');
    planner = addTodo(planner, '네 번째', 'd');

    expect(MAX_TODOS).toBe(3);
    expect(planner.todos.map((todo) => todo.title)).toEqual(['개념 정리', '문제 풀이', '오답 노트']);
    expect(planner.todos[0]).toEqual({ id: 'a', title: '개념 정리', status: 'todo' });
  });

  it('ignores blank todo titles', () => {
    const planner = addTodo(createEmptyPlannerState(), '   ', 'a');

    expect(planner.todos).toEqual([]);
  });

  it('toggles a todo between todo and done', () => {
    let planner = addTodo(createEmptyPlannerState(), '개념 정리', 'a');
    planner = toggleTodo(planner, 'a');
    expect(planner.todos[0].status).toBe('done');

    planner = toggleTodo(planner, 'a');
    expect(planner.todos[0].status).toBe('todo');
  });

  it('removes a todo by id', () => {
    let planner = addTodo(createEmptyPlannerState(), '개념 정리', 'a');
    planner = addTodo(planner, '문제 풀이', 'b');

    expect(removeTodo(planner, 'a').todos.map((todo) => todo.id)).toEqual(['b']);
  });

  it('sets the current goal', () => {
    expect(setGoal(createEmptyPlannerState(), '챕터 2').currentGoal).toBe('챕터 2');
  });

  it('adjusts focus minutes within 5..90', () => {
    const planner = createEmptyPlannerState();

    expect(adjustFocusMinutes(planner, 5).timer.focusMinutes).toBe(30);
    expect(adjustFocusMinutes(planner, -30).timer.focusMinutes).toBe(5);
    expect(adjustFocusMinutes(planner, 100).timer.focusMinutes).toBe(90);
  });
});
