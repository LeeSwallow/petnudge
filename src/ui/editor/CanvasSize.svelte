<script lang="ts">
  import { CANVAS_LIMITS, clampCanvas } from '../../domain/character/parts';
  import { resizeCanvas as preview, type Lost } from '../../domain/character/placement';
  import { editor, resizeCanvas, setBodyKind, setMerged } from './draft.svelte';
  import { notice } from './pictures.svelte';

  // The canvas size (#71): width and height (48–160 × 48–192, multiples of 8,
  // clamped), changed at any time. The parts keep standing on the same
  // ground. When the new size would cut drawn pixels off, it asks first and
  // names the parts and how many pixels each loses. And the body: on feet or
  // legless (without feet it hops or hovers), and whether it is one piece
  // with the head (then no head part is needed).

  let w = $state(editor.draft.canvas.w);
  let h = $state(editor.draft.canvas.h);
  let asking = $state<{ w: number; h: number; lost: Lost[] } | null>(null);
  // Show the draft's size again whenever it changes (undo, a new draft).
  const cw = $derived(editor.draft.canvas.w);
  const ch = $derived(editor.draft.canvas.h);
  $effect(() => {
    w = cw;
    h = ch;
    asking = null;
  });

  const apply = () => {
    const size = clampCanvas(w, h);
    [w, h] = [size.w, size.h];
    const { lost } = preview(editor.draft, size.w, size.h);
    if (lost.length) asking = { ...size, lost };
    else commit(size.w, size.h);
  };
  const commit = (cw: number, ch: number) => {
    resizeCanvas(cw, ch);
    asking = null;
    notice.text = '';
  };
  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      apply();
    }
  };
</script>

<div class="size" data-canvas-size role="group" aria-label="캔버스 크기">
  <label><span>너비</span><input type="number" data-canvas-w min={CANVAS_LIMITS.w[0]} max={CANVAS_LIMITS.w[1]} step={CANVAS_LIMITS.step} bind:value={w} {onkeydown} /></label>
  <span aria-hidden="true">×</span>
  <label><span>높이</span><input type="number" data-canvas-h min={CANVAS_LIMITS.h[0]} max={CANVAS_LIMITS.h[1]} step={CANVAS_LIMITS.step} bind:value={h} {onkeydown} /></label>
  <button type="button" data-canvas-apply onclick={apply} disabled={w === editor.draft.canvas.w && h === editor.draft.canvas.h}>크기 바꾸기</button>
  <label class="kind" title="다리 없는 몸은 발 없이 둥실 떠서 다녀요. 두 발 몸에 발이 없으면 통통 뛰어 다녀요">
    <span>몸</span>
    <select data-body-kind value={editor.draft.body.kind} onchange={(e) => setBodyKind(e.currentTarget.value as 'biped' | 'legless')}>
      <option value="biped">두 발</option>
      <option value="legless">다리 없음</option>
    </select>
  </label>
  <label class="merged" title="작은 생물처럼 머리와 몸이 한 덩어리면 머리 부위가 없어도 돼요">
    <input type="checkbox" data-merged checked={editor.draft.body.merged} onchange={(e) => setMerged(e.currentTarget.checked)} />
    <span>머리·몸 한 덩어리</span>
  </label>
</div>
{#if asking}
  <div class="confirm" data-resize-confirm role="alertdialog" aria-label="캔버스를 줄이면 잘려요">
    <span>{asking.w}×{asking.h}로 줄이면 잘려요: {asking.lost.map((l) => `${l.label} ${l.pixels}픽셀`).join(', ')}</span>
    <button type="button" data-resize-cancel onclick={() => (asking = null)}>취소</button>
    <button type="button" class="danger" data-resize-ok onclick={() => asking && commit(asking.w, asking.h)}>자르고 바꾸기</button>
  </div>
{/if}

<style>
  .size, .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-1); padding: var(--space-1) var(--space-2); font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .size label { display: flex; align-items: center; gap: 2px; }
  .size label span { color: var(--color-muted); }
  input[type='number'] { width: 52px; font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  .kind { margin-left: auto; }
  select { font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  button { font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px var(--space-1); cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: default; }
  button:focus-visible, input:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .confirm { color: var(--color-ink); background: var(--color-well); border-top: var(--stroke-frame) solid var(--color-focus); }
  .confirm span { flex: 1; min-width: 0; }
  .danger { color: var(--color-well); background: var(--color-focus); }
</style>
