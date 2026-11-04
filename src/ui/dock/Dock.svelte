<script lang="ts">
  import { revision } from '../state/revision.svelte';
  import { WIDGETS } from '../widgets/registry';
  import type { Widget } from '../widgets/widget';
  import { DOCK_GAP, dockSide } from './logic';
  import { dock } from './store.svelte';

  // The dock beside the pet: the talk button (pet/chatbar.ts puts it into
  // #dock-talk) and up to three widgets, on whichever side has room. Widgets
  // hide while the panel is open (the home board shows them). Mounted into
  // #pet-body, next to the canvas.
  type Props = { windowWidth: number; onhover: (over: boolean) => void; onheight: (px: number) => void };
  let { windowWidth, onhover, onheight }: Props = $props();

  const WIDTH = 96;
  let height = $state(0);

  const side = $derived(dockSide({ petDx: dock.petDx, windowWidth, petWidth: dock.petWidth, dockWidth: WIDTH, friendDx: dock.friendDx }));
  const widgets = $derived(dock.panelOpen ? [] : (dock.list ?? []).map((id) => WIDGETS.find((w) => w.id === id) as Widget));
  const quiet = $derived.by(() => {
    void revision.music, revision.playlists, revision.session, revision.todos, revision.notes;
    return new Set(widgets.filter((w) => w.quiet?.()).map((w) => w.id));
  });

  $effect(() => onheight(height));
</script>

<div
  id="dock"
  role="group"
  aria-label="펫 옆 도크"
  class={side}
  data-side={side}
  style:width="{WIDTH}px"
  style:--dock-gap="{DOCK_GAP}px"
  bind:clientHeight={height}
  onpointerenter={() => onhover(true)}
  onpointerleave={() => onhover(false)}
>
  <div id="dock-talk"></div>
  {#each widgets as widget (widget.id)}
    <section class="dock-widget" data-hit data-dock-widget={widget.id} aria-label={widget.label} hidden={quiet.has(widget.id)}>
      <widget.component />
    </section>
  {/each}
</div>

<style>
  #dock {
    position: absolute;
    bottom: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    line-height: normal;
  }
  /* the talk button sits toward her */
  .right { left: calc(100% + var(--dock-gap)); align-items: flex-start; }
  .left { right: calc(100% + var(--dock-gap)); align-items: flex-end; }
  .dock-widget {
    width: 100%;
    box-sizing: border-box;
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    padding: var(--space-1) var(--space-2);
  }
</style>
