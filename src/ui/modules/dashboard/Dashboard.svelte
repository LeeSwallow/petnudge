<script lang="ts">
  import { onMount } from 'svelte';
  import { EXP_PER_LEVEL, getLevel } from '../../../domain/progress/progress';
  import { api } from '../../../renderer/api';
  import { esc, heatLegend, heatmap, hourBars, splitBar, weekBars } from '../../../renderer/charts';
  import { data, STATS_WEEKS } from '../../../renderer/data';
  import { createFilter, dayHead, funnelButton, segmented } from '../../../renderer/filterBar';
  import { countUp } from '../../../renderer/fx';
  import { moodIcons, moodLabels, pixelIcon } from '../../../renderer/icons';
  import { petStore } from '../../../renderer/store';
  import { groupByDay, type DateRange } from '../../../shared/dateFilter';
  import { calendarWeeks, fillDays, fillHours, formatMinutes, lastDateKeys } from '../../../shared/stats';
  import { revision } from '../../state/revision.svelte';
  import { clock, completionRate, emptyLogText, filterSessions, logSummary, shortMinutes, type SessionRow } from './logic';

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
  let rows = $state<SessionRow[]>([]);
  let filterRev = $state(0);
  let funnelSlot: HTMLElement;
  let filterPanel: HTMLElement;
  let tileToday: HTMLElement, tileStreak: HTMLElement, tileRate: HTMLElement;
  let filter: ReturnType<typeof createFilter<DateRange & { result: string; todo: string }>> | null = $state.raw(null);

  const todoSelect = (current: string) => {
    const choices = [...todoTitles].sort(([, a], [, b]) => a.localeCompare(b, 'ko'));
    return `<label class="row">할 일 <select class="grow" data-field="todo" aria-label="연결된 할 일">
      <option value="all" ${current === 'all' ? 'selected' : ''}>모든 기록</option>
      <option value="free" ${current === 'free' ? 'selected' : ''}>자유 집중</option>
      ${choices.map(([id, title]) => `<option value="${esc(id)}" ${current === id ? 'selected' : ''}>${esc(title)}</option>`).join('')}
    </select></label>`;
  };

  // Focus records of the chosen range, newest first (the range goes to SQL).
  const loadLog = async () => {
    if (!filter) return;
    const seq = ++logSeq;
    const { from, to } = filter.bounds();
    const fetched = (await api.db.listSessions(from, to, RECORD_LIMIT)) as SessionRow[];
    if (seq !== logSeq) return;
    for (const s of fetched) if (s.todoId && s.todoTitle) todoTitles.set(s.todoId, s.todoTitle);
    const choiceKey = [...todoTitles.keys()].join();
    if (choiceKey !== todoChoiceKey) {
      todoChoiceKey = choiceKey;
      if (!filter.panelHidden()) filter.refresh();
    }
    rows = fetched;
  };

  onMount(() => {
    filter = createFilter(funnelSlot.querySelector<HTMLButtonElement>('#log-funnel')!, filterPanel, {
      kvKey: 'filter.sessions',
      defaults: { preset: '7d', from: '', to: '', result: 'all', todo: 'all' },
      extras: (state) => segmented('result', RESULTS, state.result, '결과') + todoSelect(state.todo),
      onChange: () => {
        filterRev += 1;
        void loadLog();
      }
    });
  });

  // new focus records arrive with the stats
  $effect(() => {
    void revision.stats, revision.session;
    void loadLog();
  });

  const stats = $derived.by(() => {
    void revision.stats, revision.settings, revision.session;
    const { progress } = petStore.getState();
    const goalMinutes = data.settings.dailyGoalSessions * data.settings.focusMinutes;
    const week = fillDays(lastDateKeys(data.todayKey, 7), data.daily);
    const today = week[week.length - 1];
    const { completed, abandoned, averageMood } = data.summary7;
    const exp = progress.exp % EXP_PER_LEVEL;
    return {
      progress,
      goalMinutes,
      week,
      today,
      weekMinutes: week.reduce((sum, d) => sum + d.minutes, 0),
      rate: completionRate(completed, abandoned),
      moodIndex: averageMood === null ? null : Math.round(averageMood) - 1,
      level: getLevel(progress.exp),
      exp
    };
  });

  // the headline tiles count up to their value
  $effect(() => {
    countUp(tileToday, stats.today.minutes, shortMinutes);
    countUp(tileStreak, stats.progress.streakDays, (n) => `${n}일`);
    countUp(tileRate, stats.rate, (n) => `${n}%`);
  });

  const log = $derived.by(() => {
    void filterRev;
    const shown = filterSessions(rows, String(filter?.state.result ?? 'all'), String(filter?.state.todo ?? 'all'));
    return { shown, days: groupByDay(shown, (s) => s.dateKey) };
  });
</script>

{#snippet recordRow(s: SessionRow)}
  <li>
    <span class="time">{clock(s.endedAt)}</span>
    <span class={s.completed ? '' : 'abandoned'}>{s.todoTitle ?? '자유 집중'}{#if s.note}&nbsp;· “{s.note}”{/if}</span>
    <span>{s.minutes}분 {@html s.mood ? pixelIcon(moodIcons[s.mood - 1], moodLabels[s.mood - 1]) : pixelIcon(s.completed ? 'tomato' : 'close', s.completed ? '완료' : '중단')}</span>
  </li>
{/snippet}

<div class="tiles" id="tiles">
  <div class="tile frame well"><b id="tile-today" bind:this={tileToday}>-</b><span>오늘</span></div>
  <div class="tile frame well"><b id="tile-streak" bind:this={tileStreak}>-</b><span>연속</span></div>
  <div class="tile frame well"><b id="tile-rate" bind:this={tileRate}>-</b><span>완료율</span></div>
  <div class="tile frame well"><b id="tile-mood">{@html stats.moodIndex === null ? '-' : pixelIcon(moodIcons[stats.moodIndex], moodLabels[stats.moodIndex])}</b><span>집중도</span></div>
</div>
<div class="frame well setting-group" id="stat-bars">
  <div class="bar-row"><span>Lv.{stats.level}</span>{@html splitBar(stats.exp, EXP_PER_LEVEL, 'var(--long)', `경험치 ${stats.exp}/${EXP_PER_LEVEL}`)}<span class="value">{stats.exp}/{EXP_PER_LEVEL}</span></div>
  <div class="bar-row"><span>오늘</span>{@html splitBar(stats.today.minutes, stats.goalMinutes, 'var(--focus)', `오늘 ${formatMinutes(stats.today.minutes)} / 목표 ${formatMinutes(stats.goalMinutes)}`)}<span class="value">{Math.min(100, Math.round((stats.today.minutes / stats.goalMinutes) * 100))}%</span></div>
  <div class="bar-row"><span>주간</span>{@html splitBar(stats.weekMinutes, stats.goalMinutes * 5, 'var(--break)', `이번 7일 ${formatMinutes(stats.weekMinutes)} / 주 5일 목표 ${formatMinutes(stats.goalMinutes * 5)}`)}<span class="value">{formatMinutes(stats.weekMinutes)}</span></div>
</div>
<div class="section-title">최근 7일 <small>블록 1칸 = 25분</small></div>
<div id="week">{@html weekBars(stats.week, stats.goalMinutes, data.todayKey)}</div>
<div class="section-title">시간대 분포 <small>최근 30일</small></div>
<div id="hours">{@html (void revision.stats, hourBars(fillHours(data.hourly)))}</div>
<div class="section-title">집중 히트맵 <small>최근 {STATS_WEEKS}주</small></div>
<div class="row" style="align-items:flex-end;justify-content:space-between">
  <div id="heat">{@html (void revision.stats, heatmap(calendarWeeks(data.todayKey, STATS_WEEKS, data.daily), stats.goalMinutes, data.todayKey))}</div>
  {@html heatLegend()}
</div>
<div class="section-title">집중 기록 <span class="funnel-slot" bind:this={funnelSlot}>{@html funnelButton('log-funnel', 'log-filter')}</span></div>
<div class="frame well filter-panel" id="log-filter" hidden bind:this={filterPanel}></div>
<div class="hint" id="log-summary">{logSummary(log.shown)}{#if log.shown.length && rows.length === RECORD_LIMIT}&nbsp;<small>(최근 {RECORD_LIMIT}개까지)</small>{/if}</div>
<ul class="session-log" id="log">
  {#each log.days as day (day.dateKey)}
    {@html dayHead(day.dateKey, formatMinutes(day.items.filter((s) => s.completed).reduce((sum, s) => sum + s.minutes, 0)))}
    {#each day.items as s (s.id)}{@render recordRow(s)}{/each}
  {:else}
    <li class="empty">{emptyLogText(rows.length, filter?.active() ?? false)}</li>
  {/each}
</ul>

<style>
  .funnel-slot { display: contents; }
</style>
