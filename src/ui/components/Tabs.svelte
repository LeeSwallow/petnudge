<script lang="ts">
  import { pixelIcon, type PixelIconName } from '../../renderer/icons';
  import { step } from './tabKeys';

  type Item = { id: string; label: string; icon?: PixelIconName };
  type Props = {
    items: Item[];
    selected: string;
    onselect: (id: string) => void;
    // 'group': the big row of groups; 'sub': the small tabs inside a group
    variant?: 'group' | 'sub';
    // data-<key>="<id>" on each tab, for scripts and tests (data-group, data-module)
    key: string;
    label: string;
  };
  let { items, selected, onselect, variant = 'group', key, label }: Props = $props();
  let list: HTMLElement;

  const onkeydown = (event: KeyboardEvent) => {
    const next = step(items.map((i) => i.id), selected, event.key);
    if (next === null) return;
    event.preventDefault();
    onselect(next);
    queueMicrotask(() => list.querySelector<HTMLElement>(`[data-${key}="${next}"]`)?.focus());
  };
</script>

<div class="ui-tabs {variant}" role="tablist" aria-label={label} tabindex="-1" bind:this={list} {onkeydown}>
  {#each items as item (item.id)}
    <button
      type="button"
      role="tab"
      class="ui-tab"
      aria-selected={item.id === selected}
      tabindex={item.id === selected ? 0 : -1}
      {...{ [`data-${key}`]: item.id }}
      onclick={() => onselect(item.id)}
    >
      {#if item.icon}<span class="icon">{@html pixelIcon(item.icon)}</span>{/if}
      <span class="text">{item.label}</span>
    </button>
  {/each}
</div>

<style>
  .ui-tabs { display: flex; gap: var(--space-1); flex: none; outline: none; }
  .ui-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-1);
    white-space: nowrap;
    border-radius: 0;
    cursor: pointer;
    font: var(--type-body) var(--font);
  }
  .ui-tab:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .icon { display: inline-grid; }

  .group { padding: var(--space-2) var(--space-2) 0; border-bottom: var(--stroke-panel) solid var(--color-edge); }
  .group .ui-tab {
    flex: 1 1 0;
    min-width: 0;
    padding: var(--space-1) var(--space-2);
    margin-bottom: calc(-1 * var(--stroke-panel));
    color: var(--color-muted);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-bottom: none;
  }
  .group .ui-tab[aria-selected='true'] {
    color: var(--color-ink);
    background: var(--color-panel);
    border-color: var(--color-edge);
    box-shadow: inset var(--shadow-sm) var(--shadow-sm) 0 var(--color-edge-hi);
  }
  .group .text { overflow: hidden; text-overflow: clip; }

  .sub { padding: var(--space-2) var(--space-2) 0; gap: var(--space-3); }
  .sub .ui-tab {
    padding: 0 0 var(--space-1);
    color: var(--color-muted);
    background: none;
    border: none;
    border-bottom: var(--stroke-frame) solid transparent;
    box-shadow: none;
  }
  .sub .ui-tab[aria-selected='true'] { color: var(--color-ink); border-bottom-color: var(--color-focus); }
</style>
