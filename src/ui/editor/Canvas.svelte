<script lang="ts">
  import { bounds } from '../../domain/character/pixels';
  import { composite, drawOrder, feetLine, headBox, partAt } from '../../domain/character/placement';
  import type { CharacterDraft } from '../../domain/character/standard';
  import { arrowStep, CANVAS, dragOffset, drawChecker, pixelAt, type Guides } from './canvas';
  import { editor, move, moveFrom, removePart, select, setHover } from './draft.svelte';
  import { carriesFiles, droppedFile, dropPicture, notice } from './pictures.svelte';

  // The editor canvas (#58): the parts back to front over a checkerboard at a
  // whole-number zoom, and an overlay at screen resolution for the guides and
  // the selected part's 1px outline. Drag a part to move it (snapped to whole
  // pixels); arrows move the selected part 1px, Shift+arrows 8px; Delete
  // empties it. Every change goes through the draft store, so it can be undone.
  // Hidden parts (the layer panel's eye) are not drawn; hidden and locked parts
  // cannot be picked. The part under the pointer (here or in the panel) stays
  // bright while the others dim. A PNG dropped here fills the selected layer.

  let { zoom, guides }: { zoom: number; guides: Guides } = $props();

  let art = $state<HTMLCanvasElement>();
  let overlay = $state<HTMLCanvasElement>();
  let stage = $state<HTMLDivElement>();
  const scratch = document.createElement('canvas');
  scratch.width = CANVAS.width;
  scratch.height = CANVAS.height;

  const selectedBox = $derived(editor.selected && editor.draft.parts[editor.selected] ? bounds(editor.draft.parts[editor.selected]) : undefined);
  const feet = $derived(feetLine(editor.draft));
  const head = $derived(headBox(editor.draft));

  // Hidden or locked parts are passed over when picking on the canvas.
  const unpickable = $derived(new Set([...editor.hidden, ...editor.locked]));
  const lit = $derived(editor.hovered && editor.draft.parts[editor.hovered] && !editor.hidden.has(editor.hovered) ? editor.hovered : null);

  // The art, in canvas pixels.
  $effect(() => {
    const ctx = art?.getContext('2d');
    if (!ctx) return;
    const put = (data: Uint32Array) => scratch.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(data.buffer), CANVAS.width, CANVAS.height), 0, 0);
    drawChecker(ctx);
    if (!lit) {
      put(composite(editor.draft, editor.hidden).data);
      ctx.drawImage(scratch, 0, 0);
      return;
    }
    // One part lit: the others drawn faint, in their order.
    for (const name of drawOrder(editor.draft)) {
      if (editor.hidden.has(name)) continue;
      put(editor.draft.parts[name].data);
      ctx.globalAlpha = name === lit ? 1 : 0.3;
      ctx.drawImage(scratch, 0, 0);
    }
    ctx.globalAlpha = 1;
  });

  // Guides and the selection outline, in screen pixels: 1px lines on the pixel grid.
  $effect(() => {
    const ctx = overlay?.getContext('2d');
    if (!ctx) return;
    const [w, h] = [CANVAS.width * zoom, CANVAS.height * zoom];
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;
    const box = (x0: number, y0: number, x1: number, y1: number, color: string, dash: number[] = []) => {
      ctx.setLineDash(dash);
      ctx.strokeStyle = color;
      ctx.strokeRect(x0 * zoom + 0.5, y0 * zoom + 0.5, (x1 - x0) * zoom - 1, (y1 - y0) * zoom - 1);
    };
    if (guides.border) box(0, 0, CANVAS.width, CANVAS.height, '#8a7aa8');
    if (guides.head && head) box(...head, '#7ec8e3', [4, 3]);
    if (guides.feet && feet !== undefined) {
      ctx.setLineDash([6, 3]);
      ctx.strokeStyle = '#f2c14e';
      const y = Math.min(feet * zoom, h - 1) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    if (selectedBox) box(...selectedBox, '#ffffff');
  });

  // A drag: the draft it started from, the layer and the pointer's start.
  let drag: { start: CharacterDraft; layer: string; x: number; y: number; id: string; at: [number, number] } | null = null;
  let drags = 0;

  const onpointerdown = (e: PointerEvent) => {
    if (e.button !== 0 || !overlay) return;
    stage?.focus();
    const [x, y] = pixelAt(e.clientX, e.clientY, overlay.getBoundingClientRect(), zoom);
    const layer = partAt(editor.draft, x, y, unpickable);
    if (!layer) return;
    select(layer);
    drag = { start: editor.draft, layer, x: e.clientX, y: e.clientY, id: String(++drags), at: [0, 0] };
    try {
      overlay.setPointerCapture(e.pointerId);
    } catch {
      // a synthetic pointer (the editor check) cannot be captured
    }
    e.preventDefault();
  };
  const onpointermove = (e: PointerEvent) => {
    if (!drag) {
      if (overlay) setHover(partAt(editor.draft, ...pixelAt(e.clientX, e.clientY, overlay.getBoundingClientRect(), zoom), unpickable) ?? null);
      return;
    }
    const [dx, dy] = dragOffset(drag.x, drag.y, e.clientX, e.clientY, zoom);
    if (dx === drag.at[0] && dy === drag.at[1]) return;
    drag.at = [dx, dy];
    moveFrom(drag.start, drag.layer, dx, dy, drag.id);
  };
  const onpointerup = () => {
    drag = null;
  };

  // Arrows and Delete act on the selected part, wherever the focus is, except
  // in text fields and tab bars (which use the arrows themselves).
  const ondragover = (e: DragEvent) => {
    if (carriesFiles(e)) e.preventDefault();
  };
  const ondrop = (e: DragEvent) => {
    e.preventDefault();
    const file = droppedFile(e);
    if (!file) return;
    if (editor.selected) void dropPicture(file, { layer: editor.selected });
    else notice.text = '그림을 넣을 칸을 먼저 골라 주세요';
  };

  const onkeydown = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || !editor.selected) return;
    if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable], [role=tablist]')) return;
    const step = arrowStep(e.key, e.shiftKey);
    if (step) {
      e.preventDefault();
      move(step[0], step[1], { merge: 'nudge' });
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && !editor.locked.has(editor.selected)) {
      e.preventDefault();
      removePart(editor.selected);
    }
  };
</script>

<svelte:window {onkeydown} />

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div class="stage" bind:this={stage} tabindex="0" data-stage style:width="{CANVAS.width * zoom}px" style:height="{CANVAS.height * zoom}px" aria-label="캐릭터 캔버스: 부위를 끌거나 화살표 키로 옮겨요">
  <canvas
    bind:this={art}
    data-canvas
    data-zoom={zoom}
    width={CANVAS.width}
    height={CANVAS.height}
    style:width="{CANVAS.width * zoom}px"
    style:height="{CANVAS.height * zoom}px"
    aria-label="캐릭터 캔버스 {CANVAS.width}×{CANVAS.height}, {zoom}배 확대"
  ></canvas>
  <canvas
    bind:this={overlay}
    class="overlay"
    data-overlay
    data-selection={selectedBox?.join(',') ?? ''}
    data-feet={feet ?? ''}
    data-head={head?.join(',') ?? ''}
    width={CANVAS.width * zoom}
    height={CANVAS.height * zoom}
    {onpointerdown}
    {onpointermove}
    {onpointerup}
    onpointercancel={onpointerup}
    onpointerleave={() => setHover(null)}
    {ondragover}
    {ondrop}
    data-hovered={lit ?? ''}
    aria-hidden="true"
  ></canvas>
</div>

<style>
  .stage { position: relative; outline: none; }
  .stage:focus-visible { box-shadow: 0 0 0 var(--stroke-frame) var(--color-goal); }
  canvas { display: block; image-rendering: pixelated; }
  .overlay { position: absolute; inset: 0; touch-action: none; cursor: grab; }
  .overlay:active { cursor: grabbing; }
</style>
