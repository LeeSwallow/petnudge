<script lang="ts">
  import { tick } from 'svelte';
  import { depthOf, draftProblems, findPart, isDrawn, partBox, ROOT, type Role } from '../../domain/character/parts';
  import { canSetParent } from '../../domain/character/placement';
  import { cutSelection, SELECTION_TYPE } from './cutout.svelte';
  import { addPart, backward, editor, forward, placeBeside, removeUnderlay, select, setHover, setParent, toggleHidden, toggleLocked, toggleUnderlay } from './draft.svelte';
  import { carriesFiles, droppedFile, dropPicture, notice } from './pictures.svelte';
  import { ROLE_CHOICES, ROLE_LABELS } from './roles';
  import Thumb from './Thumb.svelte';

  // The layer panel (#58, #71), like an image editor's: one row per part, the
  // front-most on top, indented under what it hangs on, with a thumbnail, its
  // name and role, an eye (show or hide on the canvas; view only, the part is
  // still saved) and a lock (a locked part cannot be picked or moved on the
  // canvas). Empty parts say so. Click a row to select its part. Drag a row:
  // onto the top or bottom edge of another row to draw it in front of or
  // behind that one (a line shows where), onto the middle of a row to hang it
  // on that part (the row lights up and says so). Alt+↑/↓ steps the order.
  // ＋ 부위 adds a part with a name, a role and where it hangs. Drop a PNG on
  // a row to fill it (on ＋ 부위 for a new part); drop the canvas's pixel selection (the chip under the
  // canvas) on a row to cut it into that part. Under the parts, the 원본
  // picture being cut up (#57) with its own eye; it is not a part.

  const rows = $derived([...editor.draft.parts].reverse());
  const labelOf = (id: string) => findPart(editor.draft, id)?.label ?? id;
  const missing = $derived(new Set(draftProblems(editor.draft).map((p) => p.code)));
  const feet = $derived(editor.draft.parts.filter((p) => p.role === 'foot' && isDrawn(p)).length);

  type Zone = 'front' | 'back' | 'parent';
  // A row drag: which part, where it started, and where it would land.
  let drag = $state<{ id: string; y: number; moving: boolean; target?: string; zone?: Zone; refused?: string } | null>(null);
  // When a row drag ended: the click that follows it is not a selection.
  let draggedAt = -Infinity;
  let list = $state<HTMLOListElement>();

  const dropPlace = (clientY: number, id: string): { target?: string; zone?: Zone; refused?: string } => {
    const others = [...(list?.querySelectorAll<HTMLElement>('[data-layer]') ?? [])].filter((row) => row.dataset.layer !== id);
    for (const row of others) {
      const r = row.getBoundingClientRect();
      if (clientY < r.top || clientY >= r.bottom) continue;
      const at = (clientY - r.top) / r.height;
      const target = row.dataset.layer!;
      if (at < 0.25) return { target, zone: 'front' };
      if (at > 0.75) return { target, zone: 'back' };
      return { target, zone: 'parent', refused: canSetParent(editor.draft, id, target) ?? undefined };
    }
    // Between rows: in front of the first row below the pointer, else behind the last.
    for (const row of others) {
      const r = row.getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return { target: row.dataset.layer!, zone: 'front' };
    }
    const last = others.at(-1);
    return last ? { target: last.dataset.layer!, zone: 'back' } : {};
  };

  const onpointermove = (e: PointerEvent) => {
    if (!drag) return;
    if (!drag.moving && Math.abs(e.clientY - drag.y) < 4) return;
    drag = { id: drag.id, y: drag.y, moving: true, ...dropPlace(e.clientY, drag.id) };
  };
  const onpointerup = () => {
    window.removeEventListener('pointermove', onpointermove);
    window.removeEventListener('pointerup', onpointerup);
    if (drag?.moving) {
      draggedAt = performance.now();
      const { id, target, zone, refused } = drag;
      if (target && zone === 'parent') {
        if (refused) notice.text = refused;
        else {
          setParent(id, target);
          notice.text = `${labelOf(id)}을(를) ${labelOf(target)}에 붙였어요`;
        }
      } else if (target && zone) placeBeside(id, target, zone);
      select(id);
    }
    drag = null;
  };
  const onpointerdown = (e: PointerEvent, id: string) => {
    if (e.button !== 0) return;
    drag = { id, y: e.clientY, moving: false };
    window.addEventListener('pointermove', onpointermove);
    window.addEventListener('pointerup', onpointerup);
  };
  const pick = (id: string) => {
    if (performance.now() - draggedAt < 300) return;
    select(id);
  };

  // Alt+↑ brings the part forward (up the list), Alt+↓ sends it back.
  const onkeydown = async (e: KeyboardEvent, id: string) => {
    if (!e.altKey || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === 'ArrowUp') forward(id);
    else backward(id);
    select(id);
    await tick();
    list?.querySelector<HTMLElement>(`[data-layer="${CSS.escape(id)}"] [data-pick]`)?.focus();
  };

  // File and selection drops onto rows.
  let fileOver = $state<string | null>(null);
  const carriesSelection = (e: DragEvent) => Boolean(e.dataTransfer?.types.includes(SELECTION_TYPE));
  const ondragover = (e: DragEvent, id: string) => {
    if (!carriesFiles(e) && !carriesSelection(e)) return;
    e.preventDefault();
    fileOver = id;
  };
  const ondrop = (e: DragEvent, id: string) => {
    e.preventDefault();
    fileOver = null;
    if (carriesSelection(e)) {
      cutSelection({ part: id });
      return;
    }
    const file = droppedFile(e);
    if (file) void dropPicture(file, { part: id });
  };

  // ＋ 부위: a name, a role and where it hangs (the selected part by default).
  let adding = $state<{ label: string; role: Role | ''; parent: string } | null>(null);
  const openAdd = () => {
    adding = { label: '', role: '', parent: editor.selected ?? ROOT };
  };
  const add = () => {
    if (!adding) return;
    const label = adding.label.trim();
    if (!label) {
      notice.text = '부위 이름을 적어 주세요';
      return;
    }
    addPart({ label, ...(adding.role ? { role: adding.role } : {}), parent: adding.parent });
    adding = null;
    notice.text = '';
  };
</script>

<p class="needs" data-requirements>
  <span>필수</span>
  <span class:ok={!missing.has('body')} data-need="body">몸 {missing.has('body') ? '없음' : '✓'}</span>
  <span class="ok" data-need="feet">발 {feet ? `${feet}개` : '없음'} (선택)</span>
  <span class:ok={!missing.has('head')} data-need="head">{editor.draft.body.merged ? '머리: 한 덩어리' : `머리 ${missing.has('head') ? '없음' : '✓'}`}</span>
</p>

<ol class="layers" bind:this={list} aria-label="부위 (위가 앞)">
  {#each rows as part (part.id)}
    {@const depth = depthOf(editor.draft, part.id)}
    {@const drawn = Boolean(partBox(part))}
    {@const over = drag?.moving && drag.target === part.id ? drag : null}
    <li
      class="row"
      class:selected={editor.selected === part.id}
      class:dragging={drag?.moving && drag.id === part.id}
      class:drop-front={over?.zone === 'front'}
      class:drop-back={over?.zone === 'back'}
      class:drop-parent={over?.zone === 'parent' && !over.refused}
      class:drop-refused={over?.zone === 'parent' && over.refused}
      class:file-over={fileOver === part.id}
      data-layer={part.id}
      data-part={part.id}
      data-parent={part.parent}
      data-depth={depth}
      data-empty={!drawn}
      data-hidden={editor.hidden.has(part.id)}
      data-locked={editor.locked.has(part.id)}
      style:--depth={depth - 1}
      onpointerenter={() => setHover(part.id)}
      onpointerleave={() => setHover(null)}
      ondragover={(e) => ondragover(e, part.id)}
      ondragleave={() => (fileOver = null)}
      ondrop={(e) => ondrop(e, part.id)}
    >
      {#if over?.zone === 'front' || over?.zone === 'back'}<span class="drop-line" data-drop-indicator={over.zone}></span>{/if}
      {#if over?.zone === 'parent'}
        <span class="drop-badge" data-drop-indicator="parent">{over.refused ? '붙일 수 없어요' : `↳ ${part.label}에 붙이기`}</span>
      {/if}
      <button
        type="button"
        class="pick"
        data-pick
        aria-pressed={editor.selected === part.id}
        title="끌어서 순서 바꾸기, 줄 가운데에 놓으면 그 부위에 붙여요 · Alt+↑/↓"
        onpointerdown={(e) => onpointerdown(e, part.id)}
        onclick={() => pick(part.id)}
        onkeydown={(e) => onkeydown(e, part.id)}
      >
        {#if depth > 1}<span class="branch" aria-hidden="true">└</span>{/if}
        {#if drawn}<Thumb pixels={part.pixels} size={24} />{:else}<span class="no-thumb" aria-hidden="true"></span>{/if}
        <span class="label">
          <span class="part-label">{part.label}</span>
          <small>{part.role ? ROLE_LABELS[part.role] : '역할 없음'}{drawn ? '' : ' · 비어 있음'}</small>
        </span>
      </button>
      <button type="button" class="icon" data-eye aria-pressed={!editor.hidden.has(part.id)} aria-label="{part.label} {editor.hidden.has(part.id) ? '보이기' : '숨기기'}" title={editor.hidden.has(part.id) ? '보이기' : '숨기기'} onclick={() => toggleHidden(part.id)}>
        {editor.hidden.has(part.id) ? '－' : '◉'}
      </button>
      <button type="button" class="icon" data-lock aria-pressed={editor.locked.has(part.id)} aria-label="{part.label} {editor.locked.has(part.id) ? '잠금 풀기' : '잠그기'}" title={editor.locked.has(part.id) ? '잠금 풀기' : '잠그기'} onclick={() => toggleLocked(part.id)}>
        {editor.locked.has(part.id) ? '■' : '□'}
      </button>
    </li>
  {/each}
  {#if editor.underlay}
    <li class="row underlay" data-underlay data-hidden={!editor.underlayShown}>
      <span class="pick static" title={editor.underlay.name}>
        <Thumb pixels={editor.underlay.rest} size={24} />
        <span class="label">
          <span class="part-label">원본</span>
          <small>{editor.underlay.name}</small>
        </span>
      </span>
      <button type="button" class="icon" data-eye aria-pressed={editor.underlayShown} aria-label="원본 {editor.underlayShown ? '숨기기' : '보이기'}" title={editor.underlayShown ? '숨기기' : '보이기'} onclick={toggleUnderlay}>
        {editor.underlayShown ? '◉' : '－'}
      </button>
      <button type="button" class="icon" data-remove-underlay aria-label="원본 치우기" title="원본 치우기 (오려 낸 부위는 남아요)" onclick={removeUnderlay}>×</button>
    </li>
  {/if}
</ol>

{#if adding}
  <form class="add" data-add-part onsubmit={(e) => { e.preventDefault(); add(); }}>
    <label><span>이름</span><input name="label" bind:value={adding.label} placeholder="예: 꼬리" maxlength="40" /></label>
    <label>
      <span>역할</span>
      <select name="role" bind:value={adding.role}>
        <option value="">없음</option>
        {#each ROLE_CHOICES as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
      </select>
    </label>
    <label>
      <span>붙는 곳</span>
      <select name="parent" bind:value={adding.parent}>
        <option value={ROOT}>바닥 (어디에도 안 붙음)</option>
        {#each rows as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
      </select>
    </label>
    <div class="add-buttons">
      <button type="button" class="text" data-add-part-cancel onclick={() => (adding = null)}>취소</button>
      <button type="submit" class="text primary" data-add-part-ok>추가</button>
    </div>
  </form>
{:else}
  <button
    type="button"
    class="add-open"
    class:file-over={fileOver === 'new'}
    data-add-part-open
    title="새 부위를 만들어요. PNG를 여기 놓으면 그 그림으로 새 부위가 생겨요"
    onclick={openAdd}
    ondragover={(e) => { if (carriesFiles(e)) { e.preventDefault(); fileOver = 'new'; } }}
    ondragleave={() => (fileOver = null)}
    ondrop={(e) => { e.preventDefault(); fileOver = null; const file = droppedFile(e); if (file) void dropPicture(file, { newPart: true }); }}
  >＋ 부위</button>
{/if}

<style>
  .needs { display: flex; flex-wrap: wrap; gap: 2px var(--space-2); margin: 0; padding: var(--space-1) var(--space-2); font: var(--type-small) var(--font-small); color: var(--color-focus); border-bottom: 1px solid var(--color-edge-lo); }
  .needs span:first-child { color: var(--color-muted); }
  .needs .ok { color: var(--color-ink-2); }
  .layers { list-style: none; margin: 0; padding: var(--space-1); display: grid; gap: var(--space-1); }
  .layers:empty { display: none; }
  .row { position: relative; display: flex; gap: 2px; padding-left: calc(var(--depth, 0) * 10px); }
  .row.dragging { opacity: 0.5; }
  .row.file-over .pick { border-color: var(--color-goal); }
  .row.drop-parent .pick { border-color: var(--color-goal); background: var(--color-panel); box-shadow: inset 0 0 0 1px var(--color-goal); }
  .row.drop-refused .pick { border-color: var(--color-focus); border-style: dashed; }
  .drop-line { position: absolute; left: calc(var(--depth, 0) * 10px); right: 0; height: var(--stroke-frame); background: var(--color-goal); pointer-events: none; }
  .drop-front .drop-line { top: calc(-1 * var(--space-1) / 2 - 1px); }
  .drop-back .drop-line { bottom: calc(-1 * var(--space-1) / 2 - 1px); }
  .drop-badge {
    position: absolute;
    right: 50px;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1;
    padding: 0 4px;
    font: var(--type-small) var(--font-small);
    color: var(--color-well);
    background: var(--color-goal);
    pointer-events: none;
    white-space: nowrap;
  }
  .drop-refused .drop-badge { background: var(--color-focus); }
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
  .row[data-empty='true'] .pick { border-style: dashed; }
  .underlay .pick.static { cursor: default; border-style: dashed; }
  .pick[aria-pressed='true'] { color: var(--color-ink); border-color: var(--color-focus); border-style: solid; }
  .row[data-hidden='true'] .pick { opacity: 0.55; }
  button:focus-visible, input:focus-visible, select:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .branch { color: var(--color-muted); font: var(--type-small) var(--font-small); }
  .no-thumb { flex: none; width: 24px; height: 24px; border: 1px dashed var(--color-edge-lo); }
  .label { display: grid; min-width: 0; }
  .part-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
  .add-open, .text {
    font: var(--type-small) var(--font-small);
    color: var(--color-ink);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-radius: 0;
    padding: 2px var(--space-2);
    cursor: pointer;
  }
  .add-open { margin: 0 var(--space-1) var(--space-1); width: calc(100% - 2 * var(--space-1)); }
  .add-open.file-over { border-color: var(--color-goal); }
  .text.primary { color: var(--color-well); background: var(--color-focus); }
  .add { display: grid; gap: var(--space-1); margin: 0 var(--space-1) var(--space-1); padding: var(--space-1); border: var(--stroke-frame) solid var(--color-edge-lo); }
  .add label { display: grid; grid-template-columns: 48px 1fr; align-items: center; gap: var(--space-1); font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .add input, .add select { min-width: 0; font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  .add-buttons { display: flex; justify-content: flex-end; gap: var(--space-1); }
</style>
