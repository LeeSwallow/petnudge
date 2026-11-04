<script lang="ts">
  import { onMount } from 'svelte';
  import type { PanelModule } from '../../renderer/modules/module';

  // An older panel module (src/renderer/modules) inside the new shell. It is
  // mounted once and only hidden when another tab shows, so its inputs keep
  // what was typed (and an IME composition) across tab switches.
  let { module, visible }: { module: PanelModule; visible: boolean } = $props();
  let node: HTMLElement;

  onMount(() => module.mount(node));
</script>

<div class="tab-body" role="tabpanel" aria-label={module.label} data-body={module.id} hidden={!visible} bind:this={node}></div>
