<script lang="ts">
  import { standardPart } from '../../domain/character/standard';
  import { Button } from '../components';
  import { clearSelection, cutout, cutSelection, SELECTION_TYPE, selectAll, setTool, TOOLS } from './cutout.svelte';
  import { editor } from './draft.svelte';
  import { LAYER_CHOICES, NEW_DECORATION } from './slots';

  // The cut-out tools under the canvas (#57), while a 원본 picture is loaded:
  // the canvas tool, select all / clear, how many pixels are selected (drag
  // that chip onto a layer row to put them there) and 칸에 넣기 with a slot.

  // The slot 칸에 넣기 fills: the selected part's layer when it has one, else the body.
  let chosen = $state('torso.chest');
  $effect(() => {
    if (editor.selected && standardPart(editor.selected)?.slot !== 'custom') chosen = editor.selected;
  });

  const put = () => cutSelection(chosen === NEW_DECORATION ? { slot: 'custom' } : { layer: chosen });

  const ondragstart = (e: DragEvent) => {
    e.dataTransfer?.setData(SELECTION_TYPE, String(cutout.count));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  };
</script>

<div class="cutout" data-cutout role="toolbar" aria-label="오려 내기">
  <div class="toggles" role="group" aria-label="캔버스 도구">
    {#each TOOLS as t (t.id)}
      <button type="button" class="toggle" data-tool-option={t.id} aria-pressed={cutout.tool === t.id} title={t.hint} onclick={() => setTool(t.id)}>{t.label}</button>
    {/each}
  </div>
  <Button variant="ghost" data-select="all" onclick={selectAll} title="그림 전체 고르기 (⌘A)">전체</Button>
  <Button variant="ghost" data-select="clear" disabled={!cutout.mask} onclick={clearSelection} title="고르기 해제 (Esc)">해제</Button>
  <span
    class="picked"
    class:some={cutout.count > 0}
    data-picked-chip
    draggable={cutout.count > 0}
    {ondragstart}
    role="status"
    title={cutout.count > 0 ? '레이어 줄에 끌어다 놓아도 넣을 수 있어요' : 'Shift: 더하기 · Alt: 빼기'}
  >{cutout.count > 0 ? `${cutout.count}픽셀` : '고른 픽셀 없음'}</span>
  <label class="target">
    <span>넣을 칸</span>
    <select bind:value={chosen} data-cut-target>
      {#each LAYER_CHOICES as group (group.slot)}
        <optgroup label={group.label}>
          {#each group.options as option (option.value)}
            <option value={option.value}>{option.label}</option>
          {/each}
        </optgroup>
      {/each}
    </select>
  </label>
  <Button variant="primary" data-cut disabled={cutout.count === 0} onclick={put}>칸에 넣기</Button>
</div>

<style>
  .cutout {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-1) var(--space-2);
    padding: var(--space-1) var(--space-2);
    border-top: var(--stroke-frame) solid var(--color-edge-lo);
  }
  .toggles { display: flex; }
  .toggle {
    font: var(--type-small) var(--font-small);
    color: var(--color-ink-2);
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-radius: 0;
    padding: 2px var(--space-1);
    cursor: pointer;
  }
  .toggle + .toggle { border-left: none; }
  .toggle[aria-pressed='true'] { color: var(--color-well); background: var(--color-focus); }
  .toggle:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .picked {
    font: var(--type-small) var(--font-small);
    color: var(--color-muted);
    padding: 2px var(--space-1);
    border: 1px dashed var(--color-edge-lo);
  }
  .picked.some { color: var(--color-ink); border-color: #7ec8e3; cursor: grab; }
  .target { display: flex; align-items: center; gap: var(--space-1); font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  select {
    font: var(--type-small) var(--font-small);
    color: var(--color-ink);
    background: var(--color-well);
    border: var(--stroke-frame) solid var(--color-shadow);
    border-radius: 0;
    padding: 2px;
  }
  select:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
</style>
