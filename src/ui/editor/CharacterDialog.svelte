<script lang="ts">
  import type { EditorCharacter, ImportedCharacter } from '../../domain/character-editor/ipc';
  import { drawOrder } from '../../domain/character/placement';
  import { findPart } from '../../domain/character/parts';
  import { Button } from '../components';
  import { editorApi } from './api';
  import { copyParts, imports, loadCharacter, startFrom } from './imports.svelte';
  import Thumb from './Thumb.svelte';

  // Another character (#57). 'parts' (다른 캐릭터에서 가져오기): tick the parts
  // to copy into this draft, one undo step. 'start' (새로 만들기 › 기존
  // 캐릭터에서 시작): the whole character as a new draft. Older packs (@2) are
  // converted to parts in main; what has no part is listed first. A copied
  // part keeps its name, role and parent; pictures fit this canvas.

  let dialog = $state<HTMLDialogElement>();
  let characters = $state<EditorCharacter[]>([]);
  let id = $state('');
  let loaded = $state.raw<ImportedCharacter | null>(null);
  let loading = $state(false);
  let error = $state('');
  let ticked = $state.raw<Record<string, boolean>>({});
  const mode = $derived(imports.characterPick);
  const parts = $derived(loaded ? drawOrder(loaded.draft).reverse() : []);

  $effect(() => {
    if (!dialog) return;
    if (mode && !dialog.open) {
      loaded = null;
      error = '';
      dialog.showModal();
      void list();
    } else if (!mode && dialog.open) dialog.close();
  });

  const list = async () => {
    const result = await editorApi.listCharacters();
    characters = result.ok ? result.value : [];
    if (!id && characters[0]) id = characters[0].id;
    if (id) await load(id);
  };

  // Only the last character asked for is shown, however the answers arrive.
  let asked = 0;
  const load = async (next: string) => {
    const ticket = ++asked;
    id = next;
    loading = true;
    error = '';
    try {
      const result = await loadCharacter(next);
      if (ticket !== asked) return;
      loaded = result;
      ticked = Object.fromEntries(drawOrder(result.draft).map((id) => [id, true]));
    } catch (e) {
      if (ticket !== asked) return;
      loaded = null;
      error = e instanceof Error ? e.message : String(e);
    } finally {
      if (ticket === asked) loading = false;
    }
  };

  const cancel = () => {
    imports.characterPick = null;
  };
  const label = (id: string) => (loaded && findPart(loaded.draft, id)?.label) || id;
  const chosen = $derived(parts.filter((layer) => ticked[layer]));
</script>

<dialog bind:this={dialog} class="dialog" data-character-dialog={mode ?? ''} aria-labelledby="character-dialog-title" oncancel={cancel}>
  {#if mode}
    <h2 id="character-dialog-title">{mode === 'start' ? '기존 캐릭터에서 시작' : '다른 캐릭터에서 가져오기'}</h2>
    <label class="pick">
      <span>캐릭터</span>
      <select value={id} onchange={(e) => load(e.currentTarget.value)} data-character-select>
        {#each characters as c (c.id)}
          <option value={c.id}>{c.name}{c.builtin ? ' (기본)' : ''}</option>
        {/each}
      </select>
    </label>
    {#if loading}
      <p class="lead" data-loading>읽는 중…</p>
    {:else if error}
      <p class="lead error" data-error>{error}</p>
    {:else if loaded}
      {#if mode === 'parts'}
        <p class="lead">가져올 부위를 골라요. 같은 이름의 부위는 그림이 바뀌고, 없는 부위는 새로 생겨요.</p>
        <ul class="list" data-parts>
          {#each parts as layer (layer)}
            <li data-part={layer}>
              <label>
                <input type="checkbox" checked={ticked[layer]} onchange={(e) => (ticked = { ...ticked, [layer]: e.currentTarget.checked })} />
                <Thumb pixels={findPart(loaded.draft, layer)!.pixels} size={24} />
                <span class="name">{label(layer)}</span>
              </label>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="lead">부위 {parts.length}개로 시작해요. 원본 캐릭터는 그대로 두고, 저장하면 새 캐릭터가 돼요.</p>
      {/if}
      {#if loaded.dropped.length}
        <details class="dropped" data-dropped open={mode === 'start'}>
          <summary>부위로 옮기지 못해 빠지는 것 {loaded.dropped.length}개</summary>
          <ul>
            {#each loaded.dropped as d, i (i)}
              <li><b>{d.name}</b> {d.reason}</li>
            {/each}
          </ul>
        </details>
      {/if}
    {/if}
    <div class="buttons">
      <Button variant="ghost" data-dialog-cancel onclick={cancel}>취소</Button>
      {#if mode === 'parts'}
        <Button variant="primary" data-dialog-ok disabled={!loaded || !chosen.length} onclick={() => loaded && copyParts(loaded, chosen)}>고른 부위 넣기</Button>
      {:else}
        <Button variant="primary" data-dialog-ok disabled={!loaded} onclick={() => loaded && startFrom(loaded)}>이 캐릭터로 시작</Button>
      {/if}
    </div>
  {/if}
</dialog>

<style>
  .dialog {
    width: min(480px, 90vw);
    max-height: 85vh;
    padding: 0;
    color: var(--color-ink);
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-md) var(--shadow-md) 0 var(--color-shadow);
  }
  .dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
  h2 { margin: 0; padding: var(--space-2); font: var(--type-body) var(--font); border-bottom: var(--stroke-frame) solid var(--color-edge-lo); }
  .pick { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-2) 0; font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .lead { margin: var(--space-2) var(--space-2) 0; font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .error { color: var(--color-focus); }
  .list { list-style: none; margin: 0; padding: var(--space-1) var(--space-2); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-1); }
  .list label { display: flex; align-items: center; gap: var(--space-1); cursor: pointer; }
  .name { font: var(--type-small) var(--font-small); }
  .dropped { margin: var(--space-2); font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .dropped ul { margin: var(--space-1) 0 0; padding-left: var(--space-3); max-height: 160px; overflow-y: auto; }
  .dropped b { color: var(--color-ink); font-weight: normal; }
  select { font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  .buttons { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-2); border-top: var(--stroke-frame) solid var(--color-edge-lo); }
</style>
