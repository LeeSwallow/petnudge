<script lang="ts">
  import { formatRemaining, getRemainingMs, getTimerProgress, isTimerPaused } from '../../../domain/pomodoro/timer';
  import { api } from '../../../renderer/api';
  import { progressRing, tomatoRow } from '../../../renderer/charts';
  import { data, refreshStats } from '../../../renderer/data';
  import { moodIcons, pixelIcon } from '../../../renderer/icons';
  import { petStore } from '../../../renderer/store';
  import { formatMinutes, locale, t } from '../../i18n';
  import TextInput from '../../components/TextInput.svelte';
  import type { MessageKey } from '../../i18n';
  import { revision } from '../../state/revision.svelte';
  import { intentText, PHASE_COLOR, phaseOf, reflectionStarts, untilLongBreak, type PhaseKind } from './logic';

  const CHIPS: [PhaseKind, MessageKey][] = [
    ['focus', 'pomodoro.phase.focus'],
    ['break', 'pomodoro.phase.break'],
    ['long', 'pomodoro.phase.long']
  ];

  const moodLabel = (i: number) => t(`pomodoro.mood.${i + 1}` as MessageKey);
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
    void revision.session, revision.settings, revision.stats, locale();
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
    <span class="chip" class:active={phase === (clock.phase === 'idle' ? 'focus' : clock.phase)} data-phase={phase} style:--chip-color={PHASE_COLOR[phase]}>{t(label)}</span>
  {/each}
</div>
<div class="timer-stage">
  <div id="ring">{@html clock.ring}</div>
  <div class="timer-readout"><span class="timer-digits" class:paused={clock.paused} id="digits">{clock.digits}</span><span class="timer-intent" id="intent">{clock.intent}</span></div>
</div>
<div class="controls" id="controls">
  {#if session.mode === 'idle'}
    <button class="primary" type="button" onclick={() => store().startFocus()}>{@html pixelIcon('play')} {t('pomodoro.start')}</button>
  {:else if session.mode === 'focus'}
    <button class="primary" type="button" onclick={() => store().togglePause()}>{@html pixelIcon(clock.paused ? 'play' : 'pause')} {clock.paused ? t('pomodoro.resume') : t('pomodoro.pause')}</button>
    <button type="button" data-tip={t('pomodoro.abandonTip')} onclick={() => store().abandonFocus()}>{@html pixelIcon('stop')} {t('pomodoro.abandon')}</button>
  {:else}
    <button type="button" onclick={() => store().togglePause()}>{@html pixelIcon(clock.paused ? 'play' : 'pause')} {clock.paused ? t('pomodoro.resume') : t('pomodoro.pause')}</button>
    <button class="primary" type="button" onclick={() => store().skipBreak()}>{@html pixelIcon('next')} {t('pomodoro.skipBreak')}</button>
  {/if}
</div>
<div class="frame reflection" id="reflection" hidden={!session.awaitingReflection}>
  {#if session.awaitingReflection}
    <div class="section-title">{t('pomodoro.reflection.title')} <small>{t('pomodoro.reflection.optional')}</small></div>
    <div class="mood" role="group" aria-label={t('pomodoro.mood')}>
      {#each moodIcons as face, i (face)}
        <button type="button" class:selected={mood === i + 1} aria-pressed={mood === i + 1} aria-label={t('pomodoro.moodN', { n: i + 1, label: moodLabel(i) })} data-tip={moodLabel(i)} onclick={() => (mood = i + 1)}>{@html pixelIcon(face)}</button>
      {/each}
    </div>
    <div class="row">
      <span class="grow"><TextInput id="reflection-note" maxlength={280} placeholder={t('pomodoro.reflection.placeholder')} bind:value={note} onenter={saveReflection} /></span>
      <button type="button" onclick={saveReflection}>{t('common.save')}</button>
    </div>
  {/if}
</div>
<div class="divider"></div>
<div id="today">
  <div class="section-title">{t('pomodoro.today')} <small>{formatMinutes(session.today.minutes)} · {t('pomodoro.goalProgress', { done: session.today.sessions, goal: data.settings.dailyGoalSessions })}</small></div>
  <div>{@html tomatoRow(session.today.sessions, data.settings.dailyGoalSessions)}</div>
</div>
<div class="hint" id="cycle">{t('pomodoro.untilLong')} {@html pixelIcon('tomato')} {t('common.count', { count: session.untilLong })} · {t('pomodoro.cycle', { focus: data.settings.focusMinutes, rest: data.settings.breakMinutes })}</div>
