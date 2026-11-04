<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  // onenter fires on Enter, but not while an IME is composing (Korean input).
  type Props = Omit<HTMLInputAttributes, 'value'> & { value?: string; onenter?: (value: string) => void };
  let { value = $bindable(''), onenter, ...rest }: Props = $props();

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.isComposing) onenter?.(value);
  };
</script>

<input class="ui-input" type="text" autocomplete="off" bind:value {onkeydown} {...rest} />

<style>
  .ui-input {
    width: 100%;
    padding: var(--space-1) var(--space-2);
    font: var(--type-body) var(--font);
    color: var(--color-ink);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    box-shadow: inset var(--shadow-sm) var(--shadow-sm) 0 #0007;
    border-radius: 0;
    outline: none;
  }
  .ui-input:focus { border-color: var(--color-edge-hi); }
</style>
