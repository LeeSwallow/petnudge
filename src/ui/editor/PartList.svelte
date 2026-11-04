<script lang="ts">
  import { isFilled, slotOrder } from '../../domain/character/placement';
  import { standardPart } from '../../domain/character/standard';
  import { editor, layerForSlot, reorderSlot, select } from './draft.svelte';
  import { EDITOR_SLOTS, type SlotId } from './slots';

  // The part list (#58): the slots back to front (top is drawn first), each
  // 비어 있음 or 채워짐. Click a slot to select its part; a slot with several
  // drawn layers (eyes, mouth, decorations) lists them to pick one. Drag a
  // slot, or use its ▲▼ buttons, to change the drawing order.

  const slots = $derived(slotOrder(editor.draft).map((id) => EDITOR_SLOTS.find((s) => s.id === id)!));
  const layersOf = (slot: SlotId) => Object.keys(editor.draft.parts).filter((name) => standardPart(name)?.slot === slot && isFilled(editor.draft, name));
  const selectedSlot = $derived(editor.selected ? standardPart(editor.selected)?.slot : undefined);
  // A click on a slot with no layer yet (장식) still shows as chosen.
  let picked = $state<SlotId | null>(null);
  const pressed = (id: SlotId) => (selectedSlot ?? picked) === id;

  const pick = (id: SlotId) => {
    picked = id;
    select(layerForSlot(editor.draft, id));
  };

  let dragging = $state<SlotId | null>(null);
  let over = $state<SlotId | null>(null);
  const ondragstart = (e: DragEvent, id: SlotId) => {
    dragging = id;
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  };
  const ondragover = (e: DragEvent, id: SlotId) => {
    if (!dragging) return;
    e.preventDefault();
    over = id;
  };
  const ondrop = (e: DragEvent, id: SlotId) => {
    e.preventDefault();
    if (dragging && dragging !== id) reorderSlot(dragging, slots.findIndex((s) => s.id === id));
    dragging = over = null;
  };
  const ondragend = () => {
    dragging = over = null;
  };
</script>

<p class="hint">위에서부터 그려요 (아래가 앞)</p>
<ol class="slot-list">
  {#each slots as slot, i (slot.id)}
    {@const layers = layersOf(slot.id)}
    <li
      class="row"
      class:dragging={dragging === slot.id}
      class:over={over === slot.id && dragging !== slot.id}
      draggable="true"
      data-slot-row={slot.id}
      ondragstart={(e) => ondragstart(e, slot.id)}
      ondragover={(e) => ondragover(e, slot.id)}
      ondrop={(e) => ondrop(e, slot.id)}
      {ondragend}
    >
      <button type="button" class="slot" data-slot={slot.id} data-state={layers.length ? 'filled' : 'empty'} aria-pressed={pressed(slot.id)} onclick={() => pick(slot.id)}>
        <span class="slot-label">{slot.label}</span>
        {#if slot.required}<span class="required" title="꼭 있어야 해요">필수</span>{/if}
        <span class="slot-state">{layers.length ? '채워짐' : '비어 있음'}</span>
      </button>
      <span class="order">
        <button type="button" data-order="up" aria-label="{slot.label} 뒤로 (위로)" title="뒤로" disabled={i === 0} onclick={() => reorderSlot(slot.id, i - 1)}>▲</button>
        <button type="button" data-order="down" aria-label="{slot.label} 앞으로 (아래로)" title="앞으로" disabled={i === slots.length - 1} onclick={() => reorderSlot(slot.id, i + 1)}>▼</button>
      </span>
      {#if layers.length > 1 || (slot.id === 'custom' && layers.length)}
        <span class="layers">
          {#each layers as layer (layer)}
            <button type="button" class="layer" data-layer={layer} aria-pressed={editor.selected === layer} onclick={() => select(layer)}>{layer}</button>
          {/each}
        </span>
      {/if}
    </li>
  {/each}
</ol>

<style>
  .hint { margin: 0; padding: var(--space-1) var(--space-2) 0; font: var(--type-small) var(--font-small); color: var(--color-muted); }
  .slot-list { list-style: none; margin: 0; padding: var(--space-1); overflow-y: auto; display: grid; gap: var(--space-1); }
  .row { display: grid; grid-template-columns: 1fr auto; gap: 2px; }
  .row.dragging { opacity: 0.5; }
  .row.over { box-shadow: 0 calc(-1 * var(--stroke-frame)) 0 var(--color-goal); }
  .slot {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-2);
    font: var(--type-body) var(--font);
    color: var(--color-ink-2);
    text-align: left;
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-radius: 0;
    cursor: pointer;
  }
  .slot[aria-pressed='true'] { color: var(--color-ink); border-color: var(--color-focus); }
  .slot[data-state='filled'] .slot-state { color: var(--color-goal); }
  button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .required { font: var(--type-small) var(--font-small); color: var(--color-focus); }
  .slot-state { margin-left: auto; font: var(--type-small) var(--font-small); color: var(--color-muted); }
  .order { display: flex; flex-direction: column; }
  .order button, .layer {
    font: var(--type-small) var(--font-small);
    color: var(--color-ink-2);
    background: var(--color-well);
    border: 1px solid var(--color-shadow);
    border-radius: 0;
    padding: 0 3px;
    cursor: pointer;
  }
  .order button { flex: 1; line-height: 1; }
  .order button:disabled { opacity: 0.35; cursor: default; }
  .layers { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 2px; padding-left: var(--space-2); }
  .layer[aria-pressed='true'] { color: var(--color-ink); border-color: var(--color-focus); }
</style>
