<script lang="ts">
  import ProgressBar from '../../components/ProgressBar.svelte';
  import { revision } from '../../state/revision.svelte';
  import { myTodos, type TodosFeed } from './feed';
  import { todosView } from './logic';
  import { t } from '../../i18n';

  let { feed = myTodos }: { feed?: TodosFeed } = $props();

  const view = $derived.by(() => {
    void revision.todos, revision.session;
    return todosView(feed.read());
  });
</script>

{#if view.empty}
  <p class="empty" data-todos-empty>{t('todo.empty')}</p>
{:else}
  <div class="count" data-todos-count>{view.done}/{view.total}</div>
  <ProgressBar value={view.done} max={view.total} label={t('widgets.todos.done')} tone="goal" />
  <p class="active" data-todos-active>{view.active ?? t('widgets.todos.noActive')}</p>
{/if}

<style>
  .count { font: var(--type-digits-md) var(--font-digits); color: var(--color-ink); }
  .active, .empty {
    margin: var(--space-1) 0 0;
    font: var(--type-small) var(--font-small);
    color: var(--color-ink-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .empty { color: var(--color-muted); }
</style>
