<script lang="ts">
  import { formatRemaining, getRemainingMs, getTimerProgress, isTimerPaused } from '../../../domain/pomodoro/timer';
  import { api } from '../../../renderer/api';
  import { progressRing, tomatoRow } from '../../../renderer/charts';
  import { data, refreshStats } from '../../../renderer/data';
  import { moodIcons, moodLabels, pixelIcon } from '../../../renderer/icons';
  import { petStore } from '../../../renderer/store';
  import { formatMinutes } from '../../../shared/stats';
  import TextInput from '../../components/TextInput.svelte';
  import { revision } from '../../state/revision.svelte';
  import { intentText, PHASE_COLOR, phaseOf, reflectionStarts, untilLongBreak, type PhaseKind } from './logic';

  const CHIPS: [PhaseKind, string][] = [
    ['focus', '집중'],
    ['break', '짧은 휴식'],
    ['long', '긴 휴식']
  ];

  let mood = $state<number | null>(null);
  let note = $state('');

  // The clock ticks four times a second (revision.clock); the rest follows real changes.
  const clock = $derived.by(() => {
    void revision.clock, revision.session, revision.settings, revision.todos;
    const { timer, activeTodoId } = petStore.getState();
    const now = Date.now();
    const phase = phaseOf(timer, data.settings);
    return {
      phase,
      ring: progressRing(getTimerProgress(timer, now), PHASE_COLOR[phase]),
      digits: formatRemaining(timer.mode === 'idle' ? data.settings.focusMinutes * 60_000 : getRemainingMs(timer, now)),
      paused: isTimerPaused(timer),
      intent: intentText(timer.mode, phase, data.todos.find((t) => t.id === activeTodoId)?.title)
    };
  });

  const session = $derived.by(() => {
    void revision.session, revision.settings, revision.stats;
    const { timer, awaitingReflection, progress } = petStore.getState();
    const today = data.daily.find((d) => d.dateKey === data.todayKey) ?? { minutes: 0, sessions: 0 };
    return { mode: timer.mode, awaitingReflection, today, untilLong: untilLongBreak(progress.completedSessions, data.settings.longBreakEvery) };
  });

  // a new reflection starts empty; one being written is left alone
  let reflectionOpen = false;
  $effect(() => {
    const open = session.awaitingReflection;
    if (reflectionStarts(reflectionOpen, open)) {
      mood = null;
      note = '';
    }
    reflectionOpen = open;
  });

  const store = () => petStore.getState();
  const saveReflection = async () => {
    await api.db.setLastSessionReflection(note, mood ?? undefined);
    store().finishReflection();
    await refreshStats();
  };
</script>

<div class="mode-chips">
  {#each CHIPS as [phase, label] (phase)}
    <span class="chip" class:active={phase === (clock.phase === 'idle' ? 'focus' : clock.phase)} data-phase={phase} style:--chip-color={PHASE_COLOR[phase]}>{label}</span>
  {/each}
</div>
<div class="timer-stage">
  <div id="ring">{@html clock.ring}</div>
  <div class="timer-readout"><span class="timer-digits" class:paused={clock.paused} id="digits">{clock.digits}</span><span class="timer-intent" id="intent">{clock.intent}</span></div>
</div>
<div class="controls" id="controls">
  {#if session.mode === 'idle'}
    <button class="primary" type="button" onclick={() => store().startFocus()}>{@html pixelIcon('play')} 집중 시작</button>
  {:else if session.mode === 'focus'}
    <button class="primary" type="button" onclick={() => store().togglePause()}>{@html pixelIcon(clock.paused ? 'play' : 'pause')} {clock.paused ? '재개' : '일시정지'}</button>
    <button type="button" data-tip="기록은 '중단'으로 남아요" onclick={() => store().abandonFocus()}>{@html pixelIcon('stop')} 그만두기</button>
  {:else}
    <button type="button" onclick={() => store().togglePause()}>{@html pixelIcon(clock.paused ? 'play' : 'pause')} {clock.paused ? '재개' : '일시정지'}</button>
    <button class="primary" type="button" onclick={() => store().skipBreak()}>{@html pixelIcon('next')} 휴식 건너뛰기</button>
  {/if}
</div>
<div class="frame reflection" id="reflection" hidden={!session.awaitingReflection}>
  {#if session.awaitingReflection}
    <div class="section-title">이번 세션 어땠어? <small>선택 사항</small></div>
    <div class="mood" role="group" aria-label="집중도">
      {#each moodIcons as face, i (face)}
        <button type="button" class:selected={mood === i + 1} aria-pressed={mood === i + 1} aria-label="집중도 {i + 1}: {moodLabels[i]}" data-tip={moodLabels[i]} onclick={() => (mood = i + 1)}>{@html pixelIcon(face)}</button>
      {/each}
    </div>
    <div class="row">
      <span class="grow"><TextInput id="reflection-note" maxlength={280} placeholder="한 줄 회고 (Enter 저장)" bind:value={note} onenter={saveReflection} /></span>
      <button type="button" onclick={saveReflection}>저장</button>
    </div>
  {/if}
</div>
<div class="divider"></div>
<div id="today">
  <div class="section-title">오늘 <small>{formatMinutes(session.today.minutes)} · 목표 {data.settings.dailyGoalSessions}개 중 {session.today.sessions}개</small></div>
  <div>{@html tomatoRow(session.today.sessions, data.settings.dailyGoalSessions)}</div>
</div>
<div class="hint" id="cycle">긴 휴식까지 {@html pixelIcon('tomato')} {session.untilLong}개 · {data.settings.focusMinutes}분 집중 / {data.settings.breakMinutes}분 휴식</div>
