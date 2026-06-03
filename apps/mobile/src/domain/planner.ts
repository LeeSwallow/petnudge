export type TodoStatus = 'todo' | 'doing' | 'done' | 'skipped';

export type TodoItem = {
  id: string;
  title: string;
  status: TodoStatus;
};

export type PomodoroSettings = {
  focusMinutes: number;
  breakMinutes: number;
};

export type PlannerState = {
  currentGoal: string;
  todos: TodoItem[];
  timer: PomodoroSettings;
};

export const createMockPlannerState = (): PlannerState => ({
  currentGoal: '챕터 1 정리하기',
  todos: [
    { id: 'todo-1', title: '노트 펼치기', status: 'done' },
    { id: 'todo-2', title: '핵심 개념 3개 정리', status: 'doing' },
    { id: 'todo-3', title: '다음 세션 문제 2개', status: 'todo' }
  ],
  timer: { focusMinutes: 25, breakMinutes: 5 }
});
