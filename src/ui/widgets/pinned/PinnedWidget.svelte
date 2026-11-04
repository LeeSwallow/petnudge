<script lang="ts">
  import { revision } from '../../state/revision.svelte';
  import { myNotes, type PinnedFeed } from './feed';
  import { EMPTY_TEXT, pinnedView } from './logic';

  let { feed = myNotes }: { feed?: PinnedFeed } = $props();

  const view = $derived.by(() => {
    void revision.notes;
    return pinnedView(feed.read());
  });
</script>

{#if view}
  <div class="title" data-pinned-title>{view.title}</div>
  {#each view.lines as line, i (i)}<div class="line">{line}</div>{/each}
{:else}
  <p class="empty" data-pinned-empty>{EMPTY_TEXT}</p>
{/if}

<style>
  .title { font: var(--type-body) var(--font); color: var(--color-ink); }
  .title, .line { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line { font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .empty { margin: 0; font: var(--type-small) var(--font-small); color: var(--color-muted); }
</style>
