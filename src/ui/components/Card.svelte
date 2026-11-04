<script lang="ts">
  import type { Snippet } from 'svelte';
  let { children }: { children: Snippet } = $props();
</script>

<div class="ui-card">{@render children()}</div>

<style>
  .ui-card {
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    padding: var(--space-2);
  }
</style>
