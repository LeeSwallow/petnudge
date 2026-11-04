<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../../../renderer/api';
  import { pack } from '../../../renderer/character';
  import type { CharacterChoice } from '../../../shared/characterImport';
  import { revision } from '../../state/revision.svelte';
  import { t } from '../../i18n';
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
      status = errorText(error, t('settings.character.listFailed'));
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
    api.openFriend(id).catch((error) => (status = errorText(error, t('friends.callFailed'))));
  };
</script>

<div class="section-title">{t('friends.title')} <small id="friends-count">{t('friends.count', { count })}</small></div>
<div class="frame well setting-group">
  <ul class="friends-list" id="friends-list">
    {#each characters as c (c.id)}
      {@const action = friendRow(c.id, mainId, out)}
      <li class="row">
        <span class="grow">{c.name}{#if c.builtin}&nbsp;<small class="hint">{t('settings.mods.builtin')}</small>{/if}</span>
        {#if action === 'main'}
          <span class="hint">{t('friends.main')}</span>
        {:else if action === 'remove'}
          <button type="button" class="ghost mini" data-id={c.id} onclick={() => api.closeFriend(c.id)}>{t('friends.sendBack')}</button>
        {:else}
          <button type="button" class="mini" data-id={c.id} onclick={() => call(c.id)}>{t('friends.call')}</button>
        {/if}
      </li>
    {/each}
  </ul>
  <button type="button" id="friends-clear" disabled={count === 1} onclick={() => out.forEach((id) => api.closeFriend(id))}>{t('friends.clear')}</button>
  <div class="hint">{t('friends.hint')}</div>
  <div class="hint" id="friends-status" role="status" aria-live="polite">{status}</div>
</div>
