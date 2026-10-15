import { pixelIcon } from '../icons';
import { esc, pomodoroCells, splitBar } from '../charts';
import { api } from '../api';
import { data, refreshTodos } from '../data';
import { petStore } from '../store';
import { createFilter, dayHead, funnelButton, segmented } from '../filterBar';
import { dateKeyOf, groupByDay, inBounds, type DateRange } from '../../shared/dateFilter';
import { $, onAction, onEnter, type PanelModule } from './module';

let root: HTMLElement;
let estimate = 1;
let poppedId: string | null = null;
let filter: ReturnType<typeof createFilter<DateRange & { status: string }>>;

const STATUS: [string, string][] = [
  ['all', '전체'],
  ['open', '진행 중'],
  ['done', '완료']
];

const finishTime = (remainingPomodoros: number) => {
  const { focusMinutes, breakMinutes } = data.settings;
  const finish = new Date(Date.now() + remainingPomodoros * (focusMinutes + breakMinutes) * 60_000);
  return `${String(finish.getHours()).padStart(2, '0')}:${String(finish.getMinutes()).padStart(2, '0')}`;
};

export const todoModule: PanelModule = {
  id: 'todo',
  label: '할 일',
  icon: 'pencil',
  watches: ['todos', 'settings', 'session'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="todo-summary frame well" id="todo-summary"></div>
      <div class="todo-form">
        <input type="text" id="todo-input" class="grow" maxlength="80" placeholder="할 일을 입력하고 Enter" />
        <span class="estimate" data-tip="예상 뽀모도로 수">
          <button type="button" data-action="est-down">-</button>
          ${pixelIcon('tomato')}<output id="todo-estimate">1</output>
          <button type="button" data-action="est-up">+</button>
        </span>
        ${funnelButton('todo-funnel', 'todo-filter')}
      </div>
      <div class="frame well filter-panel" id="todo-filter" hidden></div>
      <ul class="todo-list" id="todo-open"></ul>
      <div class="section-title" id="todo-done-title"></div>
      <ul class="todo-list" id="todo-done"></ul>`;

    filter = createFilter($<HTMLButtonElement>(root, '#todo-funnel'), $(root, '#todo-filter'), {
      kvKey: 'filter.todos',
      defaults: { preset: 'all', from: '', to: '', status: 'all' },
      extras: (state) => `${segmented('status', STATUS, state.status, '상태')}<div class="hint">진행 중은 만든 날, 완료는 끝낸 날 기준이에요</div>`,
      onChange: () => todoModule.render()
    });

    const input = $<HTMLInputElement>(root, '#todo-input');
    onEnter(input, async () => {
      const todo = await api.db.addTodo(input.value, estimate);
      if (!todo) return;
      input.value = '';
      if (!petStore.getState().activeTodoId) petStore.getState().setActiveTodo(todo.id);
      await refreshTodos();
    });

    onAction(root, {
      'est-down': () => {
        estimate = Math.max(1, estimate - 1);
        $(root, '#todo-estimate').textContent = String(estimate);
      },
      'est-up': () => {
        estimate = Math.min(12, estimate + 1);
        $(root, '#todo-estimate').textContent = String(estimate);
      },
      toggle: async (target) => {
        const todo = data.todos.find((t) => t.id === target.dataset.id);
        if (!todo) return;
        await api.db.setTodoDone(todo.id, !todo.done);
        if (!todo.done) {
          poppedId = todo.id;
          if (petStore.getState().activeTodoId === todo.id) {
            petStore.getState().setActiveTodo(data.todos.find((t) => !t.done && t.id !== todo.id)?.id ?? null);
          }
        }
        await refreshTodos();
      },
      activate: (target) => {
        const id = target.dataset.id!;
        const store = petStore.getState();
        store.setActiveTodo(store.activeTodoId === id ? null : id);
      },
      up: async (target) => {
        await api.db.moveTodo(target.dataset.id!, -1);
        await refreshTodos();
      },
      down: async (target) => {
        await api.db.moveTodo(target.dataset.id!, 1);
        await refreshTodos();
      },
      delete: async (target) => {
        await api.db.deleteTodo(target.dataset.id!);
        if (petStore.getState().activeTodoId === target.dataset.id) petStore.getState().setActiveTodo(null);
        await refreshTodos();
      },
      'clear-done': async () => {
        await api.db.clearCompletedTodos();
        await refreshTodos();
      }
    });
  },

  render() {
    const activeId = petStore.getState().activeTodoId;
    const open = data.todos.filter((t) => !t.done);
    const done = data.todos.filter((t) => t.done);
    const estimated = data.todos.reduce((sum, t) => sum + t.estimate, 0);
    const spent = data.todos.reduce((sum, t) => sum + t.pomodoros, 0);
    const remaining = open.reduce((sum, t) => sum + Math.max(0, t.estimate - t.pomodoros), 0);

    $(root, '#todo-summary').innerHTML = data.todos.length
      ? `<div class="bar-row"><span>완료</span>${splitBar(done.length, data.todos.length, 'var(--long)', `할 일 ${done.length}/${data.todos.length} 완료`)}<span class="value">${done.length}/${data.todos.length}</span></div>
         <div class="bar-row"><span>${pixelIcon('tomato')}</span>${splitBar(spent, Math.max(estimated, spent), 'var(--focus)', `뽀모도로 ${spent}/${estimated} 사용`)}<span class="value">${spent}/${estimated}</span></div>
         <div class="hint">${remaining > 0 ? `남은 ${pixelIcon('tomato')} ${remaining}개 · 지금 시작하면 <b>${finishTime(remaining)}</b> 완료 예상` : '모든 예상 뽀모도로를 채웠어요!'}</div>`
      : `<div class="hint">오늘 할 일을 적어봐요. 항목을 누르면 ${pixelIcon('play')} 지금 할 일로 지정돼요.</div>`;

    // Filtering only hides rows; the summary above still counts everything.
    const bounds = filter.bounds();
    const { status } = filter.state;
    const shownOpen = status === 'done' ? [] : open.filter((t) => inBounds(dateKeyOf(t.createdAt), bounds));
    const shownDone = status === 'open' ? [] : done.filter((t) => inBounds(dateKeyOf(t.completedAt ?? t.createdAt), bounds));
    // Up/down swaps with the neighbour in the full list, so with rows hidden
    // it would look like nothing happened; offer it only when all are shown.
    const canMove = shownOpen.length === open.length;

    const row = (t: (typeof data.todos)[number]) => `
      <li class="todo ${t.done ? 'done' : ''} ${t.id === activeId ? 'active' : ''} ${t.id === poppedId ? 'pop' : ''}">
        <button class="todo-check" type="button" data-action="toggle" data-id="${t.id}" aria-label="완료 표시">${t.done ? pixelIcon('check') : ''}</button>
        <div class="todo-main" data-action="activate" data-id="${t.id}">
          <span class="todo-title">${t.id === activeId ? pixelIcon('play') + ' ' : ''}${esc(t.title)}</span>
          <span class="todo-meta">${pomodoroCells(t.pomodoros, t.estimate)}</span>
        </div>
        <div class="todo-actions">
          ${t.done || !canMove ? '' : `<button type="button" data-action="up" data-id="${t.id}" aria-label="위로">${pixelIcon('up')}</button><button type="button" data-action="down" data-id="${t.id}" aria-label="아래로">${pixelIcon('down')}</button>`}
          <button type="button" data-action="delete" data-id="${t.id}" aria-label="삭제">${pixelIcon('close')}</button>
        </div>
      </li>`;

    const openList = $(root, '#todo-open');
    openList.hidden = status === 'done';
    openList.innerHTML = shownOpen.length
      ? shownOpen.map(row).join('')
      : `<li class="empty">${open.length ? '조건에 맞는 할 일이 없어요' : `할 일이 비었어요 ${pixelIcon('flower')}`}</li>`;

    // Completed todos read best as a diary: grouped by the day they were done.
    const days = groupByDay(
      [...shownDone].sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)),
      (t) => dateKeyOf(t.completedAt ?? t.createdAt)
    );
    $(root, '#todo-done-title').innerHTML = done.length && status !== 'open'
      ? `<span>완료한 일 ${filter.active() ? `<small>${done.length}개 중 ${shownDone.length}개</small>` : ''}</span><button class="ghost" type="button" data-action="clear-done" data-tip="완료한 일을 모두 지워요">비우기</button>`
      : '';
    $(root, '#todo-done').innerHTML =
      done.length && status !== 'open'
        ? days.map((day) => dayHead(day.dateKey, `${day.items.length}개`) + day.items.map(row).join('')).join('') ||
          (status === 'done' ? '<li class="empty">조건에 맞는 완료한 일이 없어요</li>' : '')
        : status === 'done'
          ? '<li class="empty">아직 완료한 일이 없어요</li>'
          : '';
    poppedId = null;
  }
};
