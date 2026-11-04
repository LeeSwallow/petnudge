import { formatMinutes } from '../../../shared/stats';

// The dashboard's arithmetic and wording, apart from the screen (tested in logic.test.ts).

export type SessionRow = {
  id: string;
  todoId: string | null;
  todoTitle: string | null;
  startedAt: number;
  endedAt: number;
  plannedMinutes: number;
  minutes: number;
  completed: boolean;
  pauseCount: number;
  note: string | null;
  mood: number | null;
  dateKey: string;
};

export const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// The "today" tile: 45m, 1h, 1h35.
export const shortMinutes = (n: number) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? n % 60 : ''}` : `${n}m`);

export const completionRate = (completed: number, abandoned: number) =>
  completed + abandoned > 0 ? Math.round((completed / (completed + abandoned)) * 100) : 0;

// The date range goes to SQL; result and todo are filtered here.
export const filterSessions = (rows: SessionRow[], result: string, todo: string) =>
  rows.filter(
    (s) =>
      (result === 'all' || s.completed === (result === 'done')) &&
      (todo === 'all' || (todo === 'free' ? s.todoTitle === null : s.todoId === todo))
  );

// The cap note ("최근 500개까지") is drawn apart, in small type, when fetched === limit.
export const logSummary = (shown: SessionRow[]) => {
  if (!shown.length) return '';
  const done = shown.filter((s) => s.completed);
  const minutes = done.reduce((sum, s) => sum + s.minutes, 0);
  return `${shown.length}회 · 완료 ${done.length} / 중단 ${shown.length - done.length} · 집중 ${formatMinutes(minutes)}`;
};

export const emptyLogText = (fetched: number, filtered: boolean) =>
  fetched || filtered ? '조건에 맞는 기록이 없어요' : '첫 뽀모도로를 끝내면 여기에 기록돼요';
