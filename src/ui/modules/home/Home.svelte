<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../../renderer/api';
  import Button from '../../components/Button.svelte';
  import EmptyState from '../../components/EmptyState.svelte';
  import WidgetFrame from '../../components/WidgetFrame.svelte';
  import { logError } from '../../log';
  import { WIDGETS } from '../../widgets/registry';
  import type { Widget } from '../../widgets/widget';
  import { MAX_DOCK, placementOf, placeWidget, type Placement } from '../../dock/logic';
  import { dock, loadDock, saveDock } from '../../dock/store.svelte';
  import { addable, addWidget, BOARD_KEY, moveWidget, parseBoard, removeWidget, serializeBoard } from './logic';

  const known = WIDGETS.map((w) => w.id);
  const byId = (id: string) => WIDGETS.find((w) => w.id === id) as Widget;

  // null until the saved layout is read, so the default never flashes over it
  let board = $state<string[] | null>(null);
  let menuFor = $state<string | null>(null);
  let adding = $state(false);

  const widgets = $derived((board ?? []).map(byId));
  const offered = $derived(board ? addable(board, known).map(byId) : []);

  // Where each widget shows: the board, the dock beside the pet, or both.
  const PLACES: { id: Placement; label: string }[] = [
    { id: 'board', label: '보드에' },
    { id: 'dock', label: '도크에' },
    { id: 'both', label: '둘 다' }
  ];
  const dockList = $derived(dock.list ?? []);
  const dockFull = $derived(dockList.length >= MAX_DOCK);

  onMount(async () => {
    void loadDock();
    try {
      board = parseBoard((await api.db.getKv(BOARD_KEY)) as string | null, known);
    } catch (error) {
      logError('home:board', error, 'warn');
      board = parseBoard(null, known);
    }
  });

  const save = (next: string[]) => {
    board = next;
    menuFor = null;
    adding = false;
    void api.db.setKv(BOARD_KEY, serializeBoard(next));
  };

  const place = (id: string, where: Placement) => {
    if (!board) return;
    const next = placeWidget(id, where, board, dockList);
    saveDock(next.dock);
    save(next.board);
  };

  // a click outside an open menu closes it
  const closeMenus = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-menu-root]')) return;
    menuFor = null;
    adding = false;
  };
</script>

<svelte:window onpointerdown={closeMenus} />

{#if board}
  <div class="board" data-board>
    {#each widgets as widget, i (widget.id)}
      <div class="cell" class:wide={widget.size === 2} data-widget={widget.id} data-menu-root>
        <WidgetFrame title={widget.label} onmenu={() => (menuFor = menuFor === widget.id ? null : widget.id)}>
          <widget.component />
        </WidgetFrame>
        {#if menuFor === widget.id}
          <div class="menu" role="menu" aria-label="{widget.label} 메뉴">
            <button type="button" role="menuitem" data-widget-action="up" disabled={i === 0} onclick={() => board && save(moveWidget(board, widget.id, -1))}>위로</button>
            <button type="button" role="menuitem" data-widget-action="down" disabled={i === widgets.length - 1} onclick={() => board && save(moveWidget(board, widget.id, 1))}>아래로</button>
            <button type="button" role="menuitem" data-widget-action="remove" onclick={() => board && save(removeWidget(board, widget.id))}>빼기</button>
            <div class="sep" role="separator"></div>
            {#each PLACES as p (p.id)}
              {@const here = placementOf(widget.id, board, dockList) === p.id}
              <button
                type="button"
                role="menuitemradio"
                aria-checked={here}
                data-place={p.id}
                disabled={!here && p.id !== 'board' && dockFull && !dockList.includes(widget.id)}
                title={!here && p.id !== 'board' && dockFull && !dockList.includes(widget.id) ? `도크에는 ${MAX_DOCK}개까지 둘 수 있어요` : undefined}
                onclick={() => place(widget.id, p.id)}>{here ? '✓ ' : ''}{p.label}</button>
            {/each}
          </div>
        {/if}
      </div>
    {:else}
      <div class="cell wide"><EmptyState text="위젯을 추가해 보세요" /></div>
    {/each}
  </div>
  <div class="add" data-menu-root>
    <Button variant="ghost" data-widget-add disabled={offered.length === 0} onclick={() => (adding = !adding)}>＋ 위젯 추가</Button>
    {#if adding}
      <div class="menu" role="menu" aria-label="추가할 위젯" data-widget-add-menu>
        {#each offered as widget (widget.id)}
          <button type="button" role="menuitem" data-add={widget.id} onclick={() => board && save(addWidget(board, widget.id))}>{widget.label}{dockList.includes(widget.id) ? ' (도크에 있음)' : ''}</button>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-2);
  }
  .cell { position: relative; min-width: 0; }
  .wide { grid-column: span 2; }
  .add { position: relative; margin-top: var(--space-2); display: flex; justify-content: center; }
  .menu {
    position: absolute;
    z-index: 2;
    right: var(--space-1);
    top: 22px;
    display: flex;
    flex-direction: column;
    min-width: 88px;
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-md) var(--shadow-md) 0 var(--color-shadow);
  }
  .add .menu { right: auto; top: auto; bottom: 100%; }
  .menu button {
    padding: var(--space-1) var(--space-2);
    text-align: left;
    font: var(--type-small) var(--font-small);
    color: var(--color-ink);
    background: none;
    border: none;
    box-shadow: none;
    border-radius: 0;
    cursor: pointer;
  }
  .sep { height: var(--stroke-frame); margin: var(--space-1) 0; background: var(--color-edge); }
  .menu button:hover:not(:disabled) { background: var(--color-well); }
  .menu button:disabled { color: var(--color-muted); cursor: default; }
  .menu button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
