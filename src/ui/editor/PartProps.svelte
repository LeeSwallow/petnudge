<script lang="ts">
  import { findPart, pivotOf, ROOT, subtreeOf, type Role } from '../../domain/character/parts';
  import { clearPart, deletePart, editor, setParent, updatePart } from './draft.svelte';
  import { notice } from './pictures.svelte';
  import { ROLE_CHOICES, variantLabel } from './roles';

  // The selected part's properties (#71): its name, role and where it hangs,
  // its pivot (the small cross on the canvas; drag it there), the variants it
  // has, and emptying or deleting it. Every change is one undo step.

  const part = $derived(editor.selected ? findPart(editor.draft, editor.selected) : undefined);
  // Parts it can hang on: not itself, nothing hanging on it.
  const parents = $derived(part ? [...editor.draft.parts].reverse().filter((p) => !subtreeOf(editor.draft, part.id).includes(p.id)) : []);
  const pivot = $derived(part ? pivotOf(part) : undefined);

  const rename = (e: Event & { currentTarget: HTMLInputElement }) => {
    if (part) updatePart(part.id, { label: e.currentTarget.value });
  };
  const setRole = (e: Event & { currentTarget: HTMLSelectElement }) => {
    if (part) updatePart(part.id, { role: (e.currentTarget.value || null) as Role | null });
  };
  const reparent = (e: Event & { currentTarget: HTMLSelectElement }) => {
    if (!part) return;
    try {
      setParent(part.id, e.currentTarget.value);
      notice.text = '';
    } catch (error) {
      notice.text = error instanceof Error ? error.message : String(error);
      e.currentTarget.value = part.parent;
    }
  };
</script>

{#if part}
  <section class="props" data-part-props={part.id} aria-label="부위 속성">
    <label>
      <span>이름</span>
      <input data-prop="label" value={part.label} maxlength="40" onchange={rename} onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
    </label>
    <label>
      <span>역할</span>
      <select data-prop="role" value={part.role ?? ''} onchange={setRole}>
        <option value="">없음</option>
        {#each ROLE_CHOICES as r (r.value)}<option value={r.value}>{r.label}</option>{/each}
      </select>
    </label>
    <label>
      <span>붙는 곳</span>
      <select data-prop="parent" value={part.parent} onchange={reparent}>
        <option value={ROOT}>바닥</option>
        {#each parents as p (p.id)}<option value={p.id}>{p.label}</option>{/each}
      </select>
    </label>
    <p class="row" data-prop="pivot" title="캔버스의 작은 십자를 끌어서 옮겨요">
      <span>기준점</span><span>{pivot?.[0]}, {pivot?.[1]}{part.pivot ? '' : ' (가운데)'}</span>
    </p>
    <p class="row" data-prop="variants">
      <span>변형</span><span>{Object.keys(part.variants ?? {}).map((v) => variantLabel(part, v)).join(', ') || '없음'}</span>
    </p>
    <p class="row id"><span>이름표</span><code>{part.id}</code></p>
    <div class="buttons">
      <button type="button" data-clear-part onclick={() => clearPart(part.id)} title="그림만 지우고 부위는 남겨요 (Delete)">비우기</button>
      <button type="button" data-delete-part onclick={() => deletePart(part.id)} title="부위를 목록에서 빼요. 붙어 있던 부위는 이 부위가 붙었던 곳에 붙어요">부위 지우기</button>
    </div>
  </section>
{/if}

<style>
  .props { display: grid; gap: 2px; padding: var(--space-1) var(--space-2); border-top: var(--stroke-frame) solid var(--color-edge-lo); font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  label, .row { display: grid; grid-template-columns: 52px 1fr; align-items: center; gap: var(--space-1); margin: 0; }
  input, select { min-width: 0; font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  input:focus-visible, select:focus-visible, button:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .row span:last-child, code { color: var(--color-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .id code { color: var(--color-muted); }
  .buttons { display: flex; gap: var(--space-1); justify-content: flex-end; margin-top: 2px; }
  button { font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px var(--space-1); cursor: pointer; }
</style>
