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
  import { clampEstimate, emptyText, finishTime, summarize, visibleTodos, type TodoStatus } from './logic';

  const STATUS: [string, string][] = [
    ['all', '전체'],
    ['open', '진행 중'],
    ['done', '완료']
  ];

  let title = $state('');
  let estimate = $state(1);
  // the todo just checked off, drawn with the pop animation once
  let poppedId = $state<string | null>(null);
  let filterRev = $state(0);
  let funnelSlot: HTMLElement;
  let filterPanel: HTMLElement;
  let filter: ReturnType<typeof createFilter<DateRange & { status: string }>> | null = null;

  onMount(() => {
    filter = createFilter(funnelSlot.querySelector<HTMLButtonElement>('#todo-funnel')!, filterPanel, {
      kvKey: 'filter.todos',
      defaults: { preset: 'all', from: '', to: '', status: 'all' },
      extras: (state) => `${segmented('status', STATUS, state.status, '상태')}<div class="hint">진행 중은 만든 날, 완료는 끝낸 날 기준이에요</div>`,
      onChange: () => (filterRev += 1)
    });
  });

  const view = $derived.by(() => {
    void revision.todos, revision.settings, revision.session, filterRev;
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
      poppedId = todo.id;
      const store = petStore.getState();
      if (store.activeTodoId === todo.id) store.setActiveTodo(data.todos.find((t) => !t.done && t.id !== todo.id)?.id ?? null);
    }
    await refreshTodos();
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

  // the pop shows once: forget it after the list drew it
  $effect(() => {
    if (poppedId && view) queueMicrotask(() => (poppedId = null));
  });
</script>

{#snippet row(t: Todo, canMove: boolean)}
  <li class="todo {t.done ? 'done' : ''} {t.id === view.activeId ? 'active' : ''} {t.id === poppedId ? 'pop' : ''}">
    <button class="todo-check" type="button" aria-label="완료 표시" onclick={() => toggle(t)}>{@html t.done ? pixelIcon('check') : ''}</button>
    <div class="todo-main" role="button" tabindex="-1" onclick={() => activate(t.id)} onkeydown={(e) => e.key === 'Enter' && activate(t.id)}>
      <span class="todo-title">{@html t.id === view.activeId ? pixelIcon('play') + ' ' : ''}{t.title}</span>
      <span class="todo-meta">{@html pomodoroCells(t.pomodoros, t.estimate)}</span>
    </div>
    <div class="todo-actions">
      {#if !t.done && canMove}
        <button type="button" aria-label="위로" onclick={() => move(t.id, -1)}>{@html pixelIcon('up')}</button>
        <button type="button" aria-label="아래로" onclick={() => move(t.id, 1)}>{@html pixelIcon('down')}</button>
      {/if}
      <button type="button" aria-label="삭제" onclick={() => remove(t.id)}>{@html pixelIcon('close')}</button>
    </div>
  </li>
{/snippet}

<div class="todo-summary frame well" id="todo-summary">
  {#if view.sum.total}
    <div class="bar-row"><span>완료</span>{@html splitBar(view.sum.done, view.sum.total, 'var(--long)', `할 일 ${view.sum.done}/${view.sum.total} 완료`)}<span class="value">{view.sum.done}/{view.sum.total}</span></div>
    <div class="bar-row"><span>{@html pixelIcon('tomato')}</span>{@html splitBar(view.sum.spent, Math.max(view.sum.estimated, view.sum.spent), 'var(--focus)', `뽀모도로 ${view.sum.spent}/${view.sum.estimated} 사용`)}<span class="value">{view.sum.spent}/{view.sum.estimated}</span></div>
    <div class="hint">
      {#if view.sum.remaining > 0}
        남은 {@html pixelIcon('tomato')} {view.sum.remaining}개 · 지금 시작하면 <b>{finishTime(view.sum.remaining, data.settings.focusMinutes, data.settings.breakMinutes, new Date())}</b> 완료 예상
      {:else}
        모든 예상 뽀모도로를 채웠어요!
      {/if}
    </div>
  {:else}
    <div class="hint">오늘 할 일을 적어봐요. 항목을 누르면 {@html pixelIcon('play')} 지금 할 일로 지정돼요.</div>
  {/if}
</div>
<div class="todo-form">
  <span class="grow"><TextInput id="todo-input" maxlength={80} placeholder="할 일을 입력하고 Enter" bind:value={title} onenter={add} /></span>
  <span class="estimate" data-tip="예상 뽀모도로 수">
    <button type="button" onclick={() => (estimate = clampEstimate(estimate - 1))}>-</button>
    {@html pixelIcon('tomato')}<output id="todo-estimate">{estimate}</output>
    <button type="button" onclick={() => (estimate = clampEstimate(estimate + 1))}>+</button>
  </span>
  <span class="funnel-slot" bind:this={funnelSlot}>{@html funnelButton('todo-funnel', 'todo-filter')}</span>
</div>
<div class="frame well filter-panel" id="todo-filter" hidden bind:this={filterPanel}></div>
<ul class="todo-list" id="todo-open" hidden={view.status === 'done'}>
  {#each view.shown.open as t (t.id)}
    {@render row(t, view.shown.canMove)}
  {:else}
    <li class="empty">{emptyText(view.openCount)}{#if !view.openCount}&nbsp;{@html pixelIcon('flower')}{/if}</li>
  {/each}
</ul>
<div class="section-title" id="todo-done-title">
  {#if view.doneCount && view.status !== 'open'}
    <span>완료한 일 {#if view.filtered}<small>{view.doneCount}개 중 {view.shown.done.length}개</small>{/if}</span>
    <button class="ghost" type="button" data-tip="완료한 일을 모두 지워요" onclick={clearDone}>비우기</button>
  {/if}
</div>
<ul class="todo-list" id="todo-done">
  {#if view.doneCount && view.status !== 'open'}
    {#each view.days as day (day.dateKey)}
      {@html dayHead(day.dateKey, `${day.items.length}개`)}
      {#each day.items as t (t.id)}
        {@render row(t, false)}
      {/each}
    {:else}
      {#if view.status === 'done'}<li class="empty">조건에 맞는 완료한 일이 없어요</li>{/if}
    {/each}
  {:else if view.status === 'done'}
    <li class="empty">아직 완료한 일이 없어요</li>
  {/if}
</ul>

<style>
  .funnel-slot { display: contents; }
  .grow :global(.ui-input) { width: 100%; }
</style>
