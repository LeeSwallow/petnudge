<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { pixelIcon, type PixelIconName } from '../../renderer/icons';

  type Props = HTMLButtonAttributes & { icon: PixelIconName; label: string };
  let { icon, label, type = 'button', ...rest }: Props = $props();
</script>

<button class="ui-icon-button" {type} aria-label={label} data-tip={label} {...rest}>{@html pixelIcon(icon)}</button>

<style>
  .ui-icon-button {
    width: 24px;
    height: 22px;
    padding: 0;
    display: inline-grid;
    place-items: center;
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    border-radius: 0;
    cursor: pointer;
  }
  .ui-icon-button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
