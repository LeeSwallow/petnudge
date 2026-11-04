<script lang="ts">
  import { pixelIcon } from '../../../renderer/icons';
  import { PHASE_COLOR } from '../../modules/pomodoro/logic';
  import { revision } from '../../state/revision.svelte';
  import { myTimer, type TimerFeed } from './feed';
  import { timerView } from './logic';
  import { t, type MessageKey } from '../../i18n';

  let { feed = myTimer }: { feed?: TimerFeed } = $props();

  const view = $derived.by(() => {
    void revision.clock, revision.session, revision.settings;
    return timerView(feed.read(), Date.now());
  });

  const act = () => (view.action === 'start' ? feed.start?.() : feed.togglePause?.());
  const can = $derived(view.action === 'start' ? !!feed.start : !!feed.togglePause);
  const LABEL: Record<'start' | 'pause' | 'resume', MessageKey> = { start: 'pomodoro.start', pause: 'pomodoro.pause', resume: 'pomodoro.resume' };
</script>

<div class="timer" data-phase={view.phase}>
  <div class="readout">
    <span class="digits" class:paused={view.paused} data-timer-digits>{view.digits}</span>
    <span class="phase" style:color={PHASE_COLOR[view.phase]} data-timer-phase>{view.phaseLabel}</span>
  </div>
  {#if can}
    <button type="button" class="act" data-timer-action={view.action} aria-label={t(LABEL[view.action])} data-tip={t(LABEL[view.action])} onclick={act}>
      {@html pixelIcon(view.action === 'pause' ? 'pause' : 'play')}
    </button>
  {/if}
</div>

<style>
  .timer { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2); }
  .readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--space-2); min-width: 0; }
  .digits { font: var(--type-digits-md) var(--font-digits); color: var(--color-ink); }
  .digits.paused { color: var(--color-muted); }
  .phase { font: var(--type-small) var(--font-small); }
  .act {
    width: 28px;
    height: 26px;
    padding: 0;
    display: inline-grid;
    place-items: center;
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    border-radius: 0;
    cursor: pointer;
  }
  .act:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
