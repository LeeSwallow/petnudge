<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, EmptyState, Tabs } from '../components';
  import { editorApi, logEditorError } from './api';
  import { CANVAS, DEFAULT_ZOOM, GUIDES, ZOOMS, type Guides, type Zoom } from './canvas';
  import Canvas from './Canvas.svelte';
  import { editor, redo, undo } from './draft.svelte';
  import LayerPanel from './LayerPanel.svelte';
  import { notice } from './pictures.svelte';

  // The editor's frame (#26 C): top bar, 부위/캐릭터 tabs, and three panes —
  // 부위 목록, 캔버스, 미리보기. Placing parts and undo are #58 (draft.svelte.ts);
  // import, preview and saving come in later issues, their buttons disabled until then.

  const TABS = [
    { id: 'parts', label: '부위' },
    { id: 'character', label: '캐릭터' }
  ];
  let tab = $state('parts');
  let characterCount = $state<number | null>(null);
  let zoom = $state<Zoom>(DEFAULT_ZOOM);
  let guides = $state<Guides>({ border: true, feet: true, head: true });

  // ⌘Z / Ctrl+Z undoes, with Shift redoes; a text field keeps its own undo.
  const onkeydown = (e: KeyboardEvent) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey || e.key.toLowerCase() !== 'z') return;
    if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  };

  onMount(async () => {
    const result = await editorApi.listCharacters();
    if (result.ok) characterCount = result.value.length;
    else logEditorError('editor', result);
  });
</script>

<svelte:window {onkeydown} />

<div class="editor-root">
  <header class="topbar">
    <h1>캐릭터 에디터</h1>
    <div class="actions" role="toolbar" aria-label="파일">
      <Button disabled data-action="new" title="다음 업데이트에서 열려요">새로 만들기</Button>
      <Button disabled data-action="open" title="다음 업데이트에서 열려요">열기</Button>
      <Button variant="primary" disabled data-action="save" title="다음 업데이트에서 열려요">저장</Button>
    </div>
    <div class="actions" role="toolbar" aria-label="편집">
      <Button variant="ghost" data-history="undo" disabled={!editor.canUndo} onclick={undo} title="실행 취소 (⌘Z)">되돌리기</Button>
      <Button variant="ghost" data-history="redo" disabled={!editor.canRedo} onclick={redo} title="다시 실행 (⇧⌘Z)">다시</Button>
    </div>
    <div class="toggles" role="group" aria-label="확대">
      {#each ZOOMS as z (z)}
        <button type="button" class="toggle" data-zoom-option={z} aria-pressed={zoom === z} onclick={() => (zoom = z)}>{z}×</button>
      {/each}
    </div>
    <div class="toggles" role="group" aria-label="안내선">
      {#each GUIDES as g (g.id)}
        <button type="button" class="toggle" data-guide={g.id} aria-pressed={guides[g.id]} onclick={() => (guides[g.id] = !guides[g.id])}>{g.label}</button>
      {/each}
    </div>
    <span class="count" data-character-count>{characterCount === null ? '' : `캐릭터 ${characterCount}개`}</span>
  </header>

  <Tabs items={TABS} selected={tab} onselect={(id) => (tab = id)} variant="sub" key="editor-tab" label="에디터 화면" />

  {#if tab === 'parts'}
    <main class="panes">
      <section class="pane slots" data-pane="slots" aria-labelledby="slots-title">
        <h2 id="slots-title">레이어</h2>
        <div class="pane-scroll"><LayerPanel /></div>
      </section>

      <section class="pane stage" data-pane="canvas" aria-labelledby="canvas-title">
        <h2 id="canvas-title">캔버스 <small>{CANVAS.width}×{CANVAS.height} · {zoom}배</small></h2>
        <div class="stage-well">
          <Canvas {zoom} {guides} />
        </div>
        <p class="notice" role="status" data-notice>{notice.text}</p>
      </section>

      <section class="pane preview" data-pane="preview" aria-labelledby="preview-title">
        <h2 id="preview-title">미리보기</h2>
        <div class="preview-frame" data-preview-frame>
          <EmptyState text="부위를 넣으면 여기서 움직여요" />
        </div>
      </section>
    </main>
  {:else}
    <main class="panes single">
      <section class="pane" data-pane="character" aria-labelledby="character-title">
        <h2 id="character-title">캐릭터</h2>
        <EmptyState text="이름, 성격, 반응 대사는 다음 업데이트에서 여기서 정해요" />
      </section>
    </main>
  {/if}
</div>

<style>
  .editor-root { display: flex; flex-direction: column; height: 100%; }

  .topbar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    background: var(--color-well);
    border-bottom: var(--stroke-panel) solid var(--color-edge);
  }
  h1 { margin: 0; font: bold var(--type-body) var(--font); color: var(--color-goal); }
  .actions { display: flex; gap: var(--space-2); }
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
  .count { margin-left: auto; font: var(--type-small) var(--font-small); color: var(--color-muted); }

  .panes {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 200px 1fr 200px;
    gap: var(--space-2);
    padding: var(--space-2);
  }
  .panes.single { grid-template-columns: 1fr; }
  .pane {
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-md) var(--shadow-md) 0 var(--color-shadow);
  }
  h2 {
    margin: 0;
    padding: var(--space-1) var(--space-2);
    font: var(--type-body) var(--font);
    color: var(--color-ink);
    border-bottom: var(--stroke-frame) solid var(--color-edge-lo);
  }
  h2 small { font: var(--type-small) var(--font-small); color: var(--color-muted); }

  .pane-scroll { flex: 1; min-height: 0; overflow-y: auto; }
  .notice { margin: 0; min-height: 1.5em; padding: 0 var(--space-2); font: var(--type-small) var(--font-small); color: var(--color-focus); }
  .stage-well { flex: 1; min-height: 0; display: grid; place-items: center; overflow: auto; background: var(--color-well); }

  .preview-frame {
    flex: 1;
    margin: var(--space-2);
    display: grid;
    place-items: center;
    background: var(--color-well);
    border: var(--stroke-frame) dashed var(--color-edge-lo);
  }
</style>
