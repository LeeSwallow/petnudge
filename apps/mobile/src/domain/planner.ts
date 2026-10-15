export type TodoStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type TodoItem = {
  id: string;
  title: string;
  status: TodoStatus;
};

export type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
  // Optional long break taken after every `longBreakEvery` completed sessions.
  longBreakMinutes?: number;
  longBreakEvery?: number;
};

export type PlannerState = {
  currentGoal: string;
  todos: TodoItem[];
  timer: PomodoroSettings;
};

export const MAX_TODOS = 3;
const MIN_FOCUS_MINUTES = 5;
const MAX_FOCUS_MINUTES = 90;

export const createEmptyPlannerState = (): PlannerState => ({
  currentGoal: '',
  todos: [],
  timer: { focusMinutes: 25, breakMinutes: 5 }
});

export const setGoal = (planner: PlannerState, goal: string): PlannerState => ({ ...planner, currentGoal: goal });

export const addTodo = (planner: PlannerState, title: string, id: string): PlannerState => {
  const trimmed = title.trim();
  if (!trimmed || planner.todos.length >= MAX_TODOS) return planner;
  return { ...planner, todos: [...planner.todos, { id, title: trimmed, status: 'todo' }] };
};

export const toggleTodo = (planner: PlannerState, id: string): PlannerState => ({
  ...planner,
  todos: planner.todos.map((todo) =>
    todo.id === id ? { ...todo, status: todo.status === 'done' ? 'todo' : 'done' } : todo
  )
});

export const removeTodo = (planner: PlannerState, id: string): PlannerState => ({
  ...planner,
  todos: planner.todos.filter((todo) => todo.id !== id)
});

export const adjustFocusMinutes = (planner: PlannerState, delta: number): PlannerState => ({
  ...planner,
  timer: {
    ...planner.timer,
    focusMinutes: Math.min(MAX_FOCUS_MINUTES, Math.max(MIN_FOCUS_MINUTES, planner.timer.focusMinutes + delta))
  }
});
