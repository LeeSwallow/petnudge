import { formatMinutes, formatTime, t } from '../../i18n';

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

export const clock = (ms: number) => formatTime(ms);

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
  return t('dashboard.summary', { count: shown.length, done: done.length, abandoned: shown.length - done.length, time: formatMinutes(minutes) });
};

export const emptyLogText = (fetched: number, filtered: boolean) =>
  fetched || filtered ? t('dashboard.noMatch') : t('dashboard.empty');
