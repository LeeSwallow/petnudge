<script lang="ts">
  import { standardPart } from '../../domain/character/standard';
  import { Button } from '../components';
  import { imports, placeLayered } from './imports.svelte';
  import { LAYER_CHOICES } from './slots';
  import Thumb from './Thumb.svelte';

  // 레이어 파일 불러오기 (#57): the layers whose names are not standard layer
  // names, each with a slot to put it in or 건너뛰기. The layers with standard
  // names are listed too, already in their slots.

  let dialog = $state<HTMLDialogElement>();
  let choices = $state<string[]>([]);
  const file = $derived(imports.layered);

  $effect(() => {
    if (!dialog) return;
    if (file && !dialog.open) {
      choices = file.unmatched.map(() => '');
      dialog.showModal();
    } else if (!file && dialog.open) dialog.close();
  });

  const cancel = () => {
    imports.layered = null;
  };
  const label = (layer: string) => LAYER_CHOICES.flatMap((g) => g.options).find((o) => o.value === layer)?.label ?? standardPart(layer)?.slot ?? layer;
</script>

<dialog bind:this={dialog} class="dialog" data-layered-dialog aria-labelledby="layered-title" oncancel={cancel}>
  {#if file}
    <h2 id="layered-title">레이어 파일 불러오기 <small>{file.name}</small></h2>
    {#if file.matched.length}
      <p class="lead">이름이 맞는 레이어는 그 칸에 들어가요.</p>
      <ul class="list" data-matched>
        {#each file.matched as layer (layer.layer)}
          <li data-layer-name={layer.name}><Thumb pixels={layer.pixels} size={24} /><span class="name">{layer.name}</span><span class="slot">{label(layer.layer)}</span></li>
        {/each}
      </ul>
    {/if}
    <p class="lead">이 레이어들은 넣을 칸을 골라 주세요.</p>
    <ul class="list" data-unmatched>
      {#each file.unmatched as layer, i (i)}
        <li data-layer-name={layer.name}>
          <Thumb pixels={layer.pixels} size={24} />
          <span class="name">{layer.name}</span>
          <select bind:value={choices[i]} aria-label="{layer.name} 넣을 칸">
            <option value="">건너뛰기</option>
            {#each LAYER_CHOICES as group (group.slot)}
              <optgroup label={group.label}>
                {#each group.options as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </li>
      {/each}
    </ul>
    <div class="buttons">
      <Button variant="ghost" data-dialog-cancel onclick={cancel}>취소</Button>
      <Button variant="primary" data-dialog-ok onclick={() => placeLayered(file, choices)}>넣기</Button>
    </div>
  {/if}
</dialog>

<style>
  .dialog {
    width: min(480px, 90vw);
    max-height: 80vh;
    padding: 0;
    color: var(--color-ink);
    background: var(--color-panel);
    border: var(--stroke-frame) solid var(--color-edge);
    box-shadow: var(--shadow-md) var(--shadow-md) 0 var(--color-shadow);
  }
  .dialog::backdrop { background: rgba(0, 0, 0, 0.45); }
  h2 { margin: 0; padding: var(--space-2); font: var(--type-body) var(--font); border-bottom: var(--stroke-frame) solid var(--color-edge-lo); }
  h2 small { font: var(--type-small) var(--font-small); color: var(--color-muted); }
  .lead { margin: var(--space-2) var(--space-2) 0; font: var(--type-small) var(--font-small); color: var(--color-ink-2); }
  .list { list-style: none; margin: 0; padding: var(--space-1) var(--space-2); display: grid; gap: var(--space-1); }
  .list li { display: flex; align-items: center; gap: var(--space-2); }
  .name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: var(--type-body) var(--font); }
  .slot { font: var(--type-small) var(--font-small); color: var(--color-muted); }
  select { font: var(--type-small) var(--font-small); color: var(--color-ink); background: var(--color-well); border: var(--stroke-frame) solid var(--color-shadow); border-radius: 0; padding: 2px; }
  .buttons { display: flex; justify-content: flex-end; gap: var(--space-2); padding: var(--space-2); border-top: var(--stroke-frame) solid var(--color-edge-lo); }
</style>
