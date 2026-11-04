<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack } from '../../../renderer/character';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import { revision } from '../../state/revision.svelte';
  import { errorText, friendRow, onScreenCount } from './logic';

  // The 캐릭터 tab: who is out on the desktop. The main pet always stays (it is
  // picked in 설정); every other character can be called out as a friend window
  // (main/friends.ts) or sent back.

  let characters = $state<CharacterChoice[]>([]);
  let out = $state<string[]>([]);
  let status = $state('');

  const refresh = async () => {
    try {
      [characters, out] = await Promise.all([api.listCharacters(), api.listFriends()]);
      status = '';
    } catch (error) {
      status = errorText(error, '캐릭터 목록을 읽지 못했어요');
    }
  };

  onMount(() => {
    // The listener lives as long as the panel (preload offers no unsubscribe).
    // It must return nothing: contextBridge clones a callback's return value,
    // and a Svelte state proxy cannot be cloned.
    api.onFriends((ids) => {
      out = ids;
    });
  });

  // the main pet is picked in 설정, so its change comes with the settings
  $effect(() => {
    void revision.settings;
    void refresh();
  });

  const mainId = $derived((void revision.settings, pack.id));
  const count = $derived(onScreenCount(out, mainId));

  const call = (id: string) => {
    api.openFriend(id).catch((error) => (status = errorText(error, '부르지 못했어요')));
  };
</script>

<div class="section-title">화면의 캐릭터 <small id="friends-count">화면에 {count}마리</small></div>
<div class="frame well setting-group">
  <ul class="friends-list" id="friends-list">
    {#each characters as c (c.id)}
      {@const action = friendRow(c.id, mainId, out)}
      <li class="row">
        <span class="grow">{c.name}{#if c.builtin}&nbsp;<small class="hint">기본</small>{/if}</span>
        {#if action === 'main'}
          <span class="hint">대표</span>
        {:else if action === 'remove'}
          <button type="button" class="ghost mini" data-id={c.id} onclick={() => api.closeFriend(c.id)}>돌려보내기</button>
        {:else}
          <button type="button" class="mini" data-id={c.id} onclick={() => call(c.id)}>화면에 부르기</button>
        {/if}
      </li>
    {/each}
  </ul>
  <button type="button" id="friends-clear" disabled={count === 1} onclick={() => out.forEach((id) => api.closeFriend(id))}>대표만 남기기</button>
  <div class="hint">대표 캐릭터는 설정에서 바꿔요. 부른 친구는 다음에 켤 때 다시 나오지 않아요.</div>
  <div class="hint" id="friends-status" role="status" aria-live="polite">{status}</div>
</div>
