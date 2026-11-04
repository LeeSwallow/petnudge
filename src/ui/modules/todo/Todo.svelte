<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pomodoroCells, splitBar } from '../../../renderer/charts';
  import { data, refreshTodos } from '../../../renderer/data';
  import { createFilter, dayHead, funnelButton, segmented } from '../../../renderer/filterBar';
  import { pixelIcon } from '../../../renderer/icons';
  import { petStore } from '../../../renderer/store';
  import { dateKeyOf, groupByDay, type DateRange } from '../../../shared/dateFilter';
  import type { Todo } from '../../../shared/types';
  import TextInput from '../../components/TextInput.svelte';
  import { revision } from '../../state/revision.svelte';
  import { t } from '../../i18n';
  import { clampEstimate, emptyText, finishTime, summarize, visibleTodos, type TodoStatus } from './logic';

  const STATUS = (): [string, string][] => [
    ['all', t('todo.status.all')],
    ['open', t('todo.status.open')],
    ['done', t('todo.status.done')]
  ];

  let title = $state('');
  let estimate = $state(1);
  // the todo just checked off, drawn with the pop animation once
  let poppedId = $state<string | null>(null);
  let filterRev = $state(0);
  let funnelSlot: HTMLElement;
  let filterPanel: HTMLElement;
  let filter: ReturnType<typeof createFilter<DateRange & { status: string }>> | null = $state.raw(null);

  onMount(() => {
    filter = createFilter(funnelSlot.querySelector<HTMLButtonElement>('#todo-funnel')!, filterPanel, {
      kvKey: 'filter.todos',
      defaults: { preset: 'all', from: '', to: '', status: 'all' },
      extras: (state) => `${segmented('status', STATUS(), state.status, t('todo.status.label'))}<div class="hint">${t('todo.status.hint')}</div>`,
      onChange: () => (filterRev += 1)
    });
  });

  const view = $derived.by(() => {
    void revision.todos, revision.settings, revision.session, revision.shown, filterRev;
    const todos = data.todos;
    const status = (filter?.state.status ?? 'all') as TodoStatus;
    const shown = visibleTodos(todos, filter?.bounds() ?? { from: null, to: null }, status);
    const doneAll = todos.filter((t) => t.done);
    return {
      todos,
      status,
      shown,
      openCount: todos.length - doneAll.length,
      doneCount: doneAll.length,
      sum: summarize(todos),
      activeId: petStore.getState().activeTodoId,
      filtered: filter?.active() ?? false,
      days: groupByDay([...shown.done].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)), (t) => dateKeyOf(t.completedAt ?? t.createdAt))
    };
  });

  const add = async () => {
    const todo = await api.db.addTodo(title, estimate);
    if (!todo) return;
    title = '';
    if (!petStore.getState().activeTodoId) petStore.getState().setActiveTodo(todo.id);
    await refreshTodos();
  };

  const toggle = async (todo: Todo) => {
    await api.db.setTodoDone(todo.id, !todo.done);
    if (!todo.done) {
      const store = petStore.getState();
      if (store.activeTodoId === todo.id) store.setActiveTodo(data.todos.find((t) => !t.done && t.id !== todo.id)?.id ?? null);
    }
    await refreshTodos();
    // the row now in the done list pops once (the .pop animation), then rests
    if (!todo.done) {
      poppedId = todo.id;
      setTimeout(() => {
        if (poppedId === todo.id) poppedId = null;
      }, 700);
    }
  };

  const activate = (id: string) => {
    const store = petStore.getState();
    store.setActiveTodo(store.activeTodoId === id ? null : id);
  };

  const move = async (id: string, by: -1 | 1) => {
    await api.db.moveTodo(id, by);
    await refreshTodos();
  };

  const remove = async (id: string) => {
    await api.db.deleteTodo(id);
    if (petStore.getState().activeTodoId === id) petStore.getState().setActiveTodo(null);
    await refreshTodos();
  };

  const clearDone = async () => {
    await api.db.clearCompletedTodos();
    await refreshTodos();
  };

</script>

{#snippet row(todo: Todo, canMove: boolean)}
  <li class="todo {todo.done ? 'done' : ''} {todo.id === view.activeId ? 'active' : ''} {todo.id === poppedId ? 'pop' : ''}">
    <button class="todo-check" type="button" aria-label={t('todo.markDone')} onclick={() => toggle(todo)}>{@html todo.done ? pixelIcon('check') : ''}</button>
    <div class="todo-main" role="button" tabindex="-1" onclick={() => activate(todo.id)} onkeydown={(e) => e.key === 'Enter' && activate(todo.id)}>
      <span class="todo-title">{@html todo.id === view.activeId ? pixelIcon('play') + ' ' : ''}{todo.title}</span>
      <span class="todo-meta">{@html pomodoroCells(todo.pomodoros, todo.estimate)}</span>
    </div>
    <div class="todo-actions">
      {#if !todo.done && canMove}
        <button type="button" aria-label={t('todo.moveUp')} onclick={() => move(todo.id, -1)}>{@html pixelIcon('up')}</button>
        <button type="button" aria-label={t('todo.moveDown')} onclick={() => move(todo.id, 1)}>{@html pixelIcon('down')}</button>
      {/if}
      <button type="button" aria-label={t('common.delete')} onclick={() => remove(todo.id)}>{@html pixelIcon('close')}</button>
    </div>
  </li>
{/snippet}

<div class="todo-summary frame well" id="todo-summary">
  {#if view.sum.total}
    <div class="bar-row"><span>{t('todo.status.done')}</span>{@html splitBar(view.sum.done, view.sum.total, 'var(--long)', t('todo.barDone', { done: view.sum.done, total: view.sum.total }))}<span class="value">{view.sum.done}/{view.sum.total}</span></div>
    <div class="bar-row"><span>{@html pixelIcon('tomato')}</span>{@html splitBar(view.sum.spent, Math.max(view.sum.estimated, view.sum.spent), 'var(--focus)', t('todo.barPomodoros', { spent: view.sum.spent, estimated: view.sum.estimated }))}<span class="value">{view.sum.spent}/{view.sum.estimated}</span></div>
    <div class="hint">
      {#if view.sum.remaining > 0}
        {t('todo.remainingBefore')} {@html pixelIcon('tomato')} {t('todo.remaining', { count: view.sum.remaining })} · {t('todo.finishBefore')} <b>{finishTime(view.sum.remaining, data.settings.focusMinutes, data.settings.breakMinutes, new Date())}</b> {t('todo.finishAfter')}
      {:else}
        {t('todo.allFilled')}
      {/if}
    </div>
  {:else}
    <div class="hint">{t('todo.introBefore')} {@html pixelIcon('play')} {t('todo.introAfter')}</div>
  {/if}
</div>
<div class="todo-form">
  <span class="grow"><TextInput id="todo-input" maxlength={80} placeholder={t('todo.placeholder')} bind:value={title} onenter={add} /></span>
  <span class="estimate" data-tip={t('todo.estimate')}>
    <button type="button" onclick={() => (estimate = clampEstimate(estimate - 1))}>-</button>
    {@html pixelIcon('tomato')}<output id="todo-estimate">{estimate}</output>
    <button type="button" onclick={() => (estimate = clampEstimate(estimate + 1))}>+</button>
  </span>
  <span class="funnel-slot" bind:this={funnelSlot}>{@html funnelButton('todo-funnel', 'todo-filter')}</span>
</div>
<div class="frame well filter-panel" id="todo-filter" hidden bind:this={filterPanel}></div>
<ul class="todo-list" id="todo-open" hidden={view.status === 'done'}>
  {#each view.shown.open as todo (todo.id)}
    {@render row(todo, view.shown.canMove)}
  {:else}
    <li class="empty">{emptyText(view.openCount)}{#if !view.openCount}&nbsp;{@html pixelIcon('flower')}{/if}</li>
  {/each}
</ul>
<div class="section-title" id="todo-done-title">
  {#if view.doneCount && view.status !== 'open'}
    <span>{t('todo.doneTitle')} {#if view.filtered}<small>{t('todo.filteredCount', { shown: view.shown.done.length, total: view.doneCount })}</small>{/if}</span>
    <button class="ghost" type="button" data-tip={t('todo.clearTip')} onclick={clearDone}>{t('todo.clear')}</button>
  {/if}
</div>
<ul class="todo-list" id="todo-done">
  {#if view.doneCount && view.status !== 'open'}
    {#each view.days as day (day.dateKey)}
      {@html dayHead(day.dateKey, t('common.count', { count: day.items.length }))}
      {#each day.items as todo (todo.id)}
        {@render row(todo, false)}
      {/each}
    {:else}
      {#if view.status === 'done'}<li class="empty">{t('todo.noDoneMatch')}</li>{/if}
    {/each}
  {:else if view.status === 'done'}
    <li class="empty">{t('todo.noDone')}</li>
  {/if}
</ul>

<style>
  .funnel-slot { display: contents; }
  .grow :global(.ui-input) { width: 100%; }
</style>
