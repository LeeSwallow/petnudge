<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type Props = HTMLButtonAttributes & { variant?: 'default' | 'primary' | 'ghost'; children: Snippet };
  let { variant = 'default', type = 'button', children, ...rest }: Props = $props();
</script>

<button class="ui-button {variant}" {type} {...rest}>{@render children()}</button>

<style>
  .ui-button {
    font: var(--type-body) var(--font);
    color: var(--color-ink);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    padding: var(--space-1) var(--space-2);
    border-radius: 0;
    cursor: pointer;
  }
  .ui-button:active:not(:disabled) {
    transform: translate(var(--shadow-sm), var(--shadow-sm));
    box-shadow: none;
  }
  .ui-button:disabled { opacity: 0.5; cursor: default; }
  .ui-button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .primary { color: var(--color-well); background: var(--color-focus); border-color: var(--color-shadow); }
  .ghost { background: transparent; border-color: transparent; box-shadow: none; color: var(--color-ink-2); }
</style>
