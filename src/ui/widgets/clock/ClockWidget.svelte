<script lang="ts">
  import { reducedMotion } from '../../../renderer/fx';
  import { revision } from '../../state/revision.svelte';
  import { changedCards, clockFace, type Card, type ClockFace } from './logic';

  // The pixel flip desk clock (design B of the brainstorm): a purple body with
  // two dark cards, hours and minutes. When a card's digits change, its top
  // half folds down over the old ones in held frames; reduced motion cuts.
  const FLIP_MS = 300; // the two 150ms halves of .fold and .drop below

  // renderer.ts bumps the clock every 250ms while the home board is shown
  const face = $derived.by(() => {
    void revision.clock, revision.shown;
    return clockFace(Date.now());
  });

  // the digits a card showed before it started flipping, while it flips
  const from = $state<Record<Card, string | null>>({ hours: null, minutes: null });
  const timers: Partial<Record<Card, ReturnType<typeof setTimeout>>> = {};
  let shown: ClockFace | null = null;

  $effect(() => {
    const before = shown;
    shown = face;
    if (!before || reducedMotion()) return;
    for (const card of changedCards(before, face)) {
      from[card] = before[card];
      clearTimeout(timers[card]);
      timers[card] = setTimeout(() => (from[card] = null), FLIP_MS);
    }
  });
  $effect(() => () => Object.values(timers).forEach((t) => clearTimeout(t)));
</script>

{#snippet flipCard(card: Card, value: string)}
  {@const old = from[card]}
  <div class="card" data-clock-card={card} data-flipping={old !== null ? '' : undefined}>
    <span class="num" data-clock-digits={card}>{value}</span>
    {#if old !== null}
      <span class="num half bottom" aria-hidden="true">{old}</span>
      <span class="num half top fold" aria-hidden="true">{old}</span>
      <span class="num half bottom drop" aria-hidden="true">{value}</span>
    {/if}
    <i class="split"></i>
  </div>
{/snippet}

<div class="clock" data-clock>
  <div class="desk">
    <time class="body" datetime="{face.hours}:{face.minutes}" aria-label="{face.hours}시 {face.minutes}분">
      {@render flipCard('hours', face.hours)}
      {@render flipCard('minutes', face.minutes)}
    </time>
    <i class="foot left"></i>
    <i class="foot right"></i>
  </div>
  <div class="date" data-clock-date>{face.date}</div>
</div>

<style>
  .clock { display: flex; flex-direction: column; align-items: center; gap: var(--space-1); padding-top: var(--space-1); }
  .desk { position: relative; padding-bottom: 6px; }
  /* the body: purple, a darker base, corners cut one pixel step */
  .body {
    display: flex;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-edge);
    border-bottom: var(--shadow-md) solid var(--color-edge-lo);
    clip-path: polygon(0 4px, 4px 4px, 4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px));
  }
  .foot { position: absolute; bottom: 0; width: 8px; height: 6px; background: var(--color-edge-lo); }
  .foot.left { left: var(--space-2); }
  .foot.right { right: var(--space-2); }

  .card { position: relative; width: 52px; height: 44px; background: var(--color-shadow); overflow: hidden; }
  .num {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: var(--color-shadow);
    font: var(--type-digits-lg) / 1 var(--font-digits);
    color: var(--color-ink);
    -webkit-font-smoothing: none;
  }
  .split { position: absolute; left: 0; right: 0; top: calc(50% - 1px); height: 2px; background: var(--color-panel); z-index: 1; }

  /* a flip: the old top half folds to the split, then the new bottom half
     drops from it, three held frames each (no easing) */
  .half.top { clip-path: inset(0 0 50% 0); }
  .half.bottom { clip-path: inset(50% 0 0 0); }
  .fold { animation: fold 150ms steps(3, end) forwards; }
  .drop { animation: drop 150ms steps(3, end) 150ms both; }
  @keyframes fold { from { transform: scaleY(1); } to { transform: scaleY(0); } }
  @keyframes drop { from { transform: scaleY(0); } to { transform: scaleY(1); } }

  .date { font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
</style>
