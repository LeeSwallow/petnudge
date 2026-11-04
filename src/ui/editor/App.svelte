<script lang="ts">
  import { onMount } from 'svelte';
  import { Button, EmptyState, Tabs } from '../components';
  import { editorApi, logEditorError } from './api';
  import { CANVAS, DEFAULT_ZOOM, drawChecker } from './canvas';
  import { EDITOR_SLOTS } from './slots';

  // The editor's frame (#26 C): top bar, 부위/캐릭터 tabs, and three panes —
  // 부위 목록, 캔버스, 미리보기. Import, placement, preview and saving come
  // in later issues; their buttons stay disabled until then.

  const TABS = [
    { id: 'parts', label: '부위' },
    { id: 'character', label: '캐릭터' }
  ];
  let tab = $state('parts');
  let selected = $state(EDITOR_SLOTS[0].id);
  let characterCount = $state<number | null>(null);
  const zoom = DEFAULT_ZOOM;
  let canvas = $state<HTMLCanvasElement>();

  $effect(() => {
    const ctx = canvas?.getContext('2d');
    if (ctx) drawChecker(ctx);
  });

  onMount(async () => {
    const result = await editorApi.listCharacters();
    if (result.ok) characterCount = result.value.length;
    else logEditorError('editor', result);
  });
</script>

<div class="editor-root">
  <header class="topbar">
    <h1>캐릭터 에디터</h1>
    <div class="actions" role="toolbar" aria-label="파일">
      <Button disabled data-action="new" title="다음 업데이트에서 열려요">새로 만들기</Button>
      <Button disabled data-action="open" title="다음 업데이트에서 열려요">열기</Button>
      <Button variant="primary" disabled data-action="save" title="다음 업데이트에서 열려요">저장</Button>
    </div>
    <span class="count" data-character-count>{characterCount === null ? '' : `캐릭터 ${characterCount}개`}</span>
  </header>

  <Tabs items={TABS} selected={tab} onselect={(id) => (tab = id)} variant="sub" key="editor-tab" label="에디터 화면" />

  {#if tab === 'parts'}
    <main class="panes">
      <section class="pane slots" data-pane="slots" aria-labelledby="slots-title">
        <h2 id="slots-title">부위</h2>
        <ol class="slot-list">
          {#each EDITOR_SLOTS as slot (slot.id)}
            <li>
              <button type="button" class="slot" data-slot={slot.id} aria-pressed={slot.id === selected} onclick={() => (selected = slot.id)}>
                <span class="slot-label">{slot.label}</span>
                {#if slot.required}<span class="required" title="꼭 있어야 해요">필수</span>{/if}
                <span class="slot-state">비어 있음</span>
              </button>
            </li>
          {/each}
        </ol>
      </section>

      <section class="pane stage" data-pane="canvas" aria-labelledby="canvas-title">
        <h2 id="canvas-title">캔버스 <small>{CANVAS.width}×{CANVAS.height} · {zoom}배</small></h2>
        <div class="stage-well">
          <canvas
            bind:this={canvas}
            data-canvas
            data-zoom={zoom}
            width={CANVAS.width}
            height={CANVAS.height}
            style:width="{CANVAS.width * zoom}px"
            style:height="{CANVAS.height * zoom}px"
            aria-label="캐릭터 캔버스 {CANVAS.width}×{CANVAS.height}, {zoom}배 확대"
          ></canvas>
        </div>
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
  .count { margin-left: auto; font: var(--type-small) var(--font-small); color: var(--color-muted); }

  .panes {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 180px 1fr 220px;
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

  .slot-list { list-style: none; margin: 0; padding: var(--space-1); overflow-y: auto; display: grid; gap: var(--space-1); }
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
  .slot:focus-visible { outline: var(--stroke-frame) solid var(--color-goal); outline-offset: -2px; }
  .required { font: var(--type-small) var(--font-small); color: var(--color-focus); }
  .slot-state { margin-left: auto; font: var(--type-small) var(--font-small); color: var(--color-muted); }

  .stage-well { flex: 1; min-height: 0; display: grid; place-items: center; overflow: auto; background: var(--color-well); }
  canvas {
    display: block;
    image-rendering: pixelated;
    border: var(--stroke-frame) solid var(--color-edge-hi);
    box-sizing: content-box;
  }

  .preview-frame {
    flex: 1;
    margin: var(--space-2);
    display: grid;
    place-items: center;
    background: var(--color-well);
    border: var(--stroke-frame) dashed var(--color-edge-lo);
  }
</style>
