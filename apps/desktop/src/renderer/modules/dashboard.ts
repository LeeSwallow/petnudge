import { EXP_PER_LEVEL, getLevel, unlockables } from '../../domain/progress/progress';
import { esc, heatLegend, heatmap, hourBars, splitBar, weekBars } from '../charts';
import { data, STATS_WEEKS } from '../data';
import { countUp, enter } from '../fx';
import { calendarWeeks, fillDays, fillHours, formatMinutes, lastDateKeys } from '../../shared/stats';
import { petStore } from '../store';
import { $, type PanelModule } from './module';
import { pixelIcon, moodIcons, moodLabels } from '../icons';
import { api } from '../api';
import { createFilter, dayHead, funnelButton, segmented } from '../filterBar';
import { groupByDay, type DateRange } from '../../shared/dateFilter';

let root: HTMLElement;

type SessionRow = Awaited<ReturnType<typeof api.db.listSessions>>[number];

const RECORD_LIMIT = 500;
const RESULTS: [string, string][] = [
  ['all', '전체'],
  ['done', '완료'],
  ['abandoned', '중단']
];
// Todo choices come from the records in range; titles are remembered so a
// chosen todo stays selectable after the range changes.
const todoTitles = new Map<string, string>();
let todoChoiceKey = '';
let logSeq = 0;
let filter: ReturnType<typeof createFilter<DateRange & { result: string; todo: string }>>;

const todoSelect = (current: string) => {
  const choices = [...todoTitles].sort(([, a], [, b]) => a.localeCompare(b, 'ko'));
  return `<label class="row">할 일 <select class="grow" data-field="todo" aria-label="연결된 할 일">
    <option value="all" ${current === 'all' ? 'selected' : ''}>모든 기록</option>
    <option value="free" ${current === 'free' ? 'selected' : ''}>자유 집중</option>
    ${choices.map(([id, title]) => `<option value="${esc(id)}" ${current === id ? 'selected' : ''}>${esc(title)}</option>`).join('')}
  </select></label>`;
};

const recordRow = (s: SessionRow) =>
  `<li><span class="time">${clock(s.endedAt)}</span><span class="${s.completed ? '' : 'abandoned'}">${
    s.todoTitle ? esc(s.todoTitle) : '자유 집중'
  }${s.note ? ` · “${esc(s.note)}”` : ''}</span><span>${s.minutes}분 ${
    s.mood ? pixelIcon(moodIcons[s.mood - 1], moodLabels[s.mood - 1]) : pixelIcon(s.completed ? 'tomato' : 'close', s.completed ? '완료' : '중단')
  }</span></li>`;

// Focus records grouped by the day they ended, with the funnel applied. The
// date range goes to SQL; result and todo are filtered here.
const renderLog = async () => {
  const seq = ++logSeq;
  const { from, to } = filter.bounds();
  const rows = await api.db.listSessions(from, to, RECORD_LIMIT);
  if (seq !== logSeq) return;

  for (const s of rows) if (s.todoId && s.todoTitle) todoTitles.set(s.todoId, s.todoTitle);
  const choiceKey = [...todoTitles.keys()].join();
  if (choiceKey !== todoChoiceKey) {
    todoChoiceKey = choiceKey;
    if (!filter.panelHidden()) filter.refresh();
  }

  const { result, todo } = filter.state;
  const shown = rows.filter(
    (s) =>
      (result === 'all' || s.completed === (result === 'done')) &&
      (todo === 'all' || (todo === 'free' ? s.todoTitle === null : s.todoId === todo))
  );
  const done = shown.filter((s) => s.completed);
  const minutes = done.reduce((sum, s) => sum + s.minutes, 0);

  $(root, '#log-summary').innerHTML = shown.length
    ? `${shown.length}회 · 완료 ${done.length} / 중단 ${shown.length - done.length} · 집중 ${formatMinutes(minutes)}${
        rows.length === RECORD_LIMIT ? ` <small>(최근 ${RECORD_LIMIT}개까지)</small>` : ''
      }`
    : '';
  $(root, '#log').innerHTML = shown.length
    ? groupByDay(shown, (s) => s.dateKey)
        .map((day) => dayHead(day.dateKey, formatMinutes(day.items.filter((s) => s.completed).reduce((sum, s) => sum + s.minutes, 0))) + day.items.map(recordRow).join(''))
        .join('')
    : `<li class="empty">${rows.length || filter.active() ? '조건에 맞는 기록이 없어요' : '첫 뽀모도로를 끝내면 여기에 기록돼요'}</li>`;
};

const clock = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const dashboardModule: PanelModule = {
  id: 'dashboard',
  label: '대시보드',
  icon: 'chart',
  watches: ['stats', 'settings', 'session'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="tiles" id="tiles"></div>
      <div class="frame well setting-group" id="stat-bars"></div>
      <div class="section-title">최근 7일 <small>블록 1칸 = 25분</small></div>
      <div id="week"></div>
      <div class="section-title">시간대 분포 <small>최근 30일</small></div>
      <div id="hours"></div>
      <div class="section-title">집중 히트맵 <small>최근 ${STATS_WEEKS}주</small></div>
      <div class="row" style="align-items:flex-end;justify-content:space-between"><div id="heat"></div>${heatLegend()}</div>
      <div class="section-title">집중 기록 ${funnelButton('log-funnel', 'log-filter')}</div>
      <div class="frame well filter-panel" id="log-filter" hidden></div>
      <div class="hint" id="log-summary"></div>
      <ul class="session-log" id="log"></ul>`;

    filter = createFilter($<HTMLButtonElement>(root, '#log-funnel'), $(root, '#log-filter'), {
      kvKey: 'filter.sessions',
      defaults: { preset: '7d', from: '', to: '', result: 'all', todo: 'all' },
      extras: (state) => segmented('result', RESULTS, state.result, '결과') + todoSelect(state.todo),
      onChange: () => void renderLog()
    });
  },

  render() {
    const { progress } = petStore.getState();
    const goalMinutes = data.settings.dailyGoalSessions * data.settings.focusMinutes;
    const weekKeys = lastDateKeys(data.todayKey, 7);
    const week = fillDays(weekKeys, data.daily);
    const today = week[week.length - 1];
    const weekMinutes = week.reduce((sum, d) => sum + d.minutes, 0);
    const { completed, abandoned, averageMood } = data.summary7;
    const rate = completed + abandoned > 0 ? Math.round((completed / (completed + abandoned)) * 100) : 0;

    // Headline numbers as stat tiles (a chart would add nothing here).
    $(root, '#tiles').innerHTML = [
      ['today', '오늘'],
      ['streak', '연속'],
      ['rate', '완료율'],
      ['mood', '집중도']
    ]
      .map(([id, label]) => `<div class="tile frame well"><b id="tile-${id}">-</b><span>${label}</span></div>`)
      .join('');
    countUp($(root, '#tile-today'), today.minutes, (n) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? n % 60 : ''}` : `${n}m`));
    countUp($(root, '#tile-streak'), progress.streakDays, (n) => `${n}일`);
    countUp($(root, '#tile-rate'), rate, (n) => `${n}%`);
    $(root, '#tile-mood').innerHTML = averageMood === null ? '-' : pixelIcon(moodIcons[Math.round(averageMood) - 1], moodLabels[Math.round(averageMood) - 1]);

    // VPet-style stat bars: level, today's goal, this week.
    const level = getLevel(progress.exp);
    const nextUnlock = unlockables.find((u) => !progress.unlockedIds.includes(u.id));
    $(root, '#stat-bars').innerHTML = `
      <div class="bar-row"><span>Lv.${level}</span>${splitBar(progress.exp % EXP_PER_LEVEL, EXP_PER_LEVEL, 'var(--long)', `경험치 ${progress.exp % EXP_PER_LEVEL}/${EXP_PER_LEVEL}`)}<span class="value">${progress.exp % EXP_PER_LEVEL}/${EXP_PER_LEVEL}</span></div>
      <div class="bar-row"><span>오늘</span>${splitBar(today.minutes, goalMinutes, 'var(--focus)', `오늘 ${formatMinutes(today.minutes)} / 목표 ${formatMinutes(goalMinutes)}`)}<span class="value">${Math.min(100, Math.round((today.minutes / goalMinutes) * 100))}%</span></div>
      <div class="bar-row"><span>주간</span>${splitBar(weekMinutes, goalMinutes * 5, 'var(--break)', `이번 7일 ${formatMinutes(weekMinutes)} / 주 5일 목표 ${formatMinutes(goalMinutes * 5)}`)}<span class="value">${formatMinutes(weekMinutes)}</span></div>
      ${
        nextUnlock
          ? `<div class="bar-row"><span>해금</span>${splitBar(progress.completedSessions, nextUnlock.requiredSessions, 'var(--goal)', `${esc(nextUnlock.title)}까지 ${Math.max(0, nextUnlock.requiredSessions - progress.completedSessions)}세션`)}<span class="value">${progress.completedSessions}/${nextUnlock.requiredSessions}</span></div>`
          : ''
      }`;

    $(root, '#week').innerHTML = weekBars(week, goalMinutes, data.todayKey);
    $(root, '#hours').innerHTML = hourBars(fillHours(data.hourly));
    $(root, '#heat').innerHTML = heatmap(calendarWeeks(data.todayKey, STATS_WEEKS, data.daily), goalMinutes, data.todayKey);

    void renderLog();

    enter(root, 'grow');
  }
};
