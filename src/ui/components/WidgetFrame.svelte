<script lang="ts">
  import type { Snippet } from 'svelte';
  import { t } from '../i18n';
  type Props = { title: string; onmenu?: () => void; children: Snippet };
  let { title, onmenu, children }: Props = $props();
</script>

<section class="ui-widget" aria-label={title}>
  <header>
    <span>{title}</span>
    {#if onmenu}<button type="button" class="menu" aria-label={t('widgets.menuLabel', { title })} onclick={onmenu}>⋯</button>{/if}
  </header>
  {@render children()}
</section>

<style>
  .ui-widget {
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-sm) var(--shadow-sm) 0 var(--color-shadow);
    padding: var(--space-1) var(--space-2) var(--space-2);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font: var(--type-small) var(--font-small);
    color: var(--color-muted);
    margin-bottom: var(--space-1);
  }
  .menu { padding: 0 var(--space-1); background: none; border: none; box-shadow: none; color: var(--color-muted); cursor: pointer; }
</style>
