<script lang="ts">
  import { tick } from 'svelte';
  import { drawOrder, isFilled } from '../../domain/character/placement';
  import { STANDARD_SLOTS, standardPart, type SlotId } from '../../domain/character/standard';
  import { backward, editor, forward, layerForSlot, placeBeside, select, setHover, toggleHidden, toggleLocked } from './draft.svelte';
  import { carriesFiles, droppedFile, dropPicture } from './pictures.svelte';
  import Thumb from './Thumb.svelte';

  // The layer panel (#58), like an image editor's: one row per drawn part,
  // the front-most on top, with a thumbnail, its slot, an eye (show or hide on
  // the canvas; view only, the part is still saved) and a lock (a locked part
  // cannot be picked or moved on the canvas). Click a row to select its part;
  // drag a row (or Alt+↑/↓) to change the drawing order. Below the divider,
  // the slots with nothing yet ("빈 칸"). Drop a PNG on any row to fill it.

  const slotOf = (layer: string) => STANDARD_SLOTS.find((s) => s.id === standardPart(layer)?.slot)!;
  const layers = $derived(drawOrder(editor.draft).filter((name) => isFilled(editor.draft, name)).reverse());
  const empties = $derived(STANDARD_SLOTS.filter((s) => s.id === 'custom' || !layers.some((name) => slotOf(name).id === s.id)));
  // Slots with more than one picture show which one a row is.
  const detail = (layer: string) => (slotOf(layer).parts.length === 1 ? '' : layer);

  // A row drag: which layer, where it started, and where it would land.
  let drag = $state<{ layer: string; y: number; moving: boolean; target?: string; side?: 'front' | 'back' } | null>(null);
  // When a row drag ended: the click that follows it is not a selection.
  let draggedAt = -Infinity;
  let list = $state<HTMLOListElement>();

  const dropPlace = (clientY: number, layer: string) => {
    const rows = [...(list?.querySelectorAll<HTMLElement>('[data-layer]') ?? [])].filter((row) => row.dataset.layer !== layer);
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return { target: row.dataset.layer!, side: 'front' as const };
    }
    const last = rows.at(-1);
    return last ? { target: last.dataset.layer!, side: 'back' as const } : {};
  };

  const onpointermove = (e: PointerEvent) => {
    if (!drag) return;
    if (!drag.moving && Math.abs(e.clientY - drag.y) < 4) return;
    drag = { ...drag, moving: true, ...dropPlace(e.clientY, drag.layer) };
  };
  const onpointerup = () => {
    window.removeEventListener('pointermove', onpointermove);
    window.removeEventListener('pointerup', onpointerup);
    if (drag?.moving) {
      draggedAt = performance.now();
      if (drag.target && drag.side) placeBeside(drag.layer, drag.target, drag.side);
      select(drag.layer);
    }
    drag = null;
  };
  const onpointerdown = (e: PointerEvent, layer: string) => {
    if (e.button !== 0) return;
    drag = { layer, y: e.clientY, moving: false };
    window.addEventListener('pointermove', onpointermove);
    window.addEventListener('pointerup', onpointerup);
  };
  const pick = (layer: string) => {
    if (performance.now() - draggedAt < 300) return;
    select(layer);
  };

  // Alt+↑ brings the part forward (up the list), Alt+↓ sends it back.
  const onkeydown = async (e: KeyboardEvent, layer: string) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'ArrowUp') forward(layer);
    else backward(layer);
    select(layer);
    await tick();
    list?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(layer)}"] [data-pick]`)?.focus();
  };

  // File drops onto rows.
  let fileOver = $state<string | null>(null);
  const ondragover = (e: DragEvent, key: string) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    fileOver = key;
  };
  const ondrop = (e: DragEvent, target: { layer: string } | { slot: SlotId }) => {
    e.preventDefault();
    fileOver = null;
    const file = droppedFile(e);
    if (file) void dropPicture(file, target);
  };
</script>

<ol class="layers" bind:this={list} aria-label="레이어 (위가 앞)">
  {#each layers as layer (layer)}
    {@const slot = slotOf(layer)}
    <li
      class="row"
      class:selected={editor.selected === layer}
      class:dragging={drag?.moving && drag.layer === layer}
      class:drop-front={drag?.moving && drag.target === layer && drag.side === 'front'}
      class:drop-back={drag?.moving && drag.target === layer && drag.side === 'back'}
      class:file-over={fileOver === layer}
      data-layer={layer}
      data-slot={slot.id}
      data-hidden={editor.hidden.has(layer)}
      data-locked={editor.locked.has(layer)}
      onpointerenter={() => setHover(layer)}
      onpointerleave={() => setHover(null)}
      ondragover={(e) => ondragover(e, layer)}
      ondragleave={() => (fileOver = null)}
      ondrop={(e) => ondrop(e, { layer })}
    >
      {#if drag?.moving && drag.target === layer}<span class="drop-line" data-drop-indicator={drag.side}></span>{/if}
      <button
        type="button"
        class="pick"
        data-pick
        aria-pressed={editor.selected === layer}
        title="끌어서 순서 바꾸기 · Alt+↑/↓"
        onpointerdown={(e) => onpointerdown(e, layer)}
        onclick={() => pick(layer)}
        onkeydown={(e) => onkeydown(e, layer)}
      >
        <Thumb pixels={editor.draft.parts[layer]} />
        <span class="label">
          <span class="slot-label">{slot.label}</span>
          {#if detail(layer)}<small>{detail(layer)}</small>{/if}
        </span>
      </button>
      <button type="button" class="icon" data-eye aria-pressed={!editor.hidden.has(layer)} aria-label="{slot.label} {editor.hidden.has(layer) ? '보이기' : '숨기기'}" title={editor.hidden.has(layer) ? '보이기' : '숨기기'} onclick={() => toggleHidden(layer)}>
        {editor.hidden.has(layer) ? '－' : '◉'}
      </button>
      <button type="button" class="icon" data-lock aria-pressed={editor.locked.has(layer)} aria-label="{slot.label} {editor.locked.has(layer) ? '잠금 풀기' : '잠그기'}" title={editor.locked.has(layer) ? '잠금 풀기' : '잠그기'} onclick={() => toggleLocked(layer)}>
        {editor.locked.has(layer) ? '■' : '□'}
      </button>
    </li>
  {/each}
</ol>

<p class="divider">빈 칸 <small>PNG를 끌어다 놓아요</small></p>
<ul class="empties">
  {#each empties as slot (slot.id)}
    <li
      class="row empty"
      class:file-over={fileOver === `slot:${slot.id}`}
      data-empty-slot={slot.id}
      data-slot={slot.id}
      ondragover={(e) => ondragover(e, `slot:${slot.id}`)}
      ondragleave={() => (fileOver = null)}
      ondrop={(e) => ondrop(e, { slot: slot.id })}
    >
      <button type="button" class="pick" aria-pressed={editor.selected !== null && !isFilled(editor.draft, editor.selected) && standardPart(editor.selected)?.slot === slot.id} onclick={() => select(layerForSlot(editor.draft, slot.id))}>
        <span class="slot-label">{slot.label}</span>
        {#if slot.required}<span class="required" title="꼭 있어야 해요">필수</span>{/if}
        <span class="slot-state">{slot.id === 'custom' && layers.some((l) => slotOf(l).id === 'custom') ? '더 넣기' : '비어 있음'}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .layers, .empties { list-style: none; margin: 0; padding: var(--space-1); display: grid; gap: var(--space-1); }
  .layers { overflow-y: auto; }
  .layers:empty { display: none; }
  .row { position: relative; display: flex; gap: 2px; }
  .row.dragging { opacity: 0.5; }
  .row.file-over .pick { border-color: var(--color-goal); }
  .drop-line { position: absolute; left: 0; right: 0; height: var(--stroke-frame); background: var(--color-goal); pointer-events: none; }
  .drop-front .drop-line { top: calc(-1 * var(--space-1) / 2 - 1px); }
  .drop-back .drop-line { bottom: calc(-1 * var(--space-1) / 2 - 1px); }
  .pick {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 2px var(--space-1);
    font: var(--type-body) var(--font);
    color: var(--color-ink-2);
    text-align: left;
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-radius: 0;
    cursor: grab;
    touch-action: none;
  }
  .empty .pick { cursor: pointer; padding: var(--space-1) var(--space-2); }
  .pick[aria-pressed='true'] { color: var(--color-ink); border-color: var(--color-focus); }
  .row[data-hidden='true'] .pick { opacity: 0.55; }
  button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .label { display: grid; min-width: 0; }
  .label small { font: var(--type-small) var(--font-small); color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icon {
    width: 22px;
    font: var(--type-small) var(--font-small);
    color: var(--color-ink-2);
    background: var(--color-well);
    border: 1px solid var(--color-shadow);
    border-radius: 0;
    cursor: pointer;
    padding: 0;
  }
  .icon[data-lock][aria-pressed='true'] { color: var(--color-focus); }
  .divider {
    margin: var(--space-1) var(--space-1) 0;
    padding-top: var(--space-1);
    border-top: var(--stroke-frame) solid var(--color-edge-lo);
    font: var(--type-small) var(--font-small);
    color: var(--color-muted);
  }
  .required { font: var(--type-small) var(--font-small); color: var(--color-focus); }
  .slot-state { margin-left: auto; font: var(--type-small) var(--font-small); color: var(--color-muted); }
</style>
