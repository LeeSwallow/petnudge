<script lang="ts">
  import { tick } from 'svelte';
  import { api } from '../../../renderer/api';
  import { data, refreshPlaylists, updateSettings } from '../../../renderer/data';
  import { enter } from '../../../renderer/fx';
  import { pixelIcon } from '../../../renderer/icons';
  import { music, playPlaylist } from '../../../renderer/music';
  import { parseMusicLink } from '../../../shared/music';
  import TextInput from '../../components/TextInput.svelte';
  import { revision } from '../../state/revision.svelte';
  import { t } from '../../i18n';
  import { addedText, localTrack, selectedList, sourceKind } from './logic';

  let selectedId = $state<string | null>(null);
  let message = $state('');
  let newName = $state('');
  let link = $state('');
  let dragging = $state(false);
  let volume = $state(data.settings.musicVolume);
  let volumeActive = false;
  let items: HTMLElement;

  const view = $derived.by(() => {
    void revision.playlists, revision.settings, revision.music;
    const { settings, playlists } = data;
    const track = music.nowPlaying;
    return {
      settings,
      playlists,
      track,
      queue: music.queue,
      queueList: music.queue ? playlists.find((p) => p.id === music.queue!.playlistId) ?? null : null,
      list: selectedList(playlists, selectedId)
    };
  });

  // the slider follows the saved volume, except while it is being dragged
  $effect(() => {
    if (!volumeActive) volume = view.settings.musicVolume;
  });

  const flash = (text: string) => {
    message = text;
    setTimeout(() => {
      if (message === text) message = '';
    }, 2500);
  };

  const choose = async (id: string) => {
    selectedId = id;
    await tick();
    enter(items, 'settle');
  };

  const createList = async () => {
    const id = await api.db.createPlaylist(newName);
    if (!id) return;
    newName = '';
    selectedId = id;
    await refreshPlaylists();
  };

  const addFiles = async (paths: string[]) => {
    let list = selectedList(data.playlists, selectedId);
    if (!list) {
      const id = await api.db.createPlaylist(t('music.defaultList'));
      await refreshPlaylists();
      selectedId = id;
      list = selectedList(data.playlists, id);
    }
    if (!list) return;
    let added = 0;
    for (const path of paths) if (await api.db.addPlaylistItem(list.id, localTrack(path))) added += 1;
    await refreshPlaylists();
    flash(addedText(added));
  };

  const addLink = async () => {
    const list = view.list;
    const parsed = parseMusicLink(link);
    if (!list) return flash(t('music.needList'));
    if (!parsed) return flash(t('music.spotifyOnly'));
    await api.db.addPlaylistItem(list.id, { player: parsed.player, ref: parsed.ref, title: `Spotify ${parsed.kind}`, artist: parsed.ref.split(':')[2] });
    link = '';
    await refreshPlaylists();
  };

  const addCurrent = async () => {
    const list = view.list;
    const track = music.nowPlaying;
    if (!list) return flash(t('music.needList'));
    if (!track || track.player === 'Local') return flash(t('music.playFirst'));
    const ok = await api.db.addPlaylistItem(list.id, track);
    flash(ok ? t('music.addedTrack', { title: track.title }) : t('music.cannotAdd'));
    await refreshPlaylists();
  };

  const deleteList = async () => {
    const list = view.list;
    if (!list) return;
    await api.db.deletePlaylist(list.id);
    selectedId = null;
    await Promise.all([refreshPlaylists(), updateSettings({})]);
  };

  const moveItem = async (id: string, by: -1 | 1) => {
    await api.db.movePlaylistItem(id, by);
    await refreshPlaylists();
  };

  const removeItem = async (id: string) => {
    await api.db.removePlaylistItem(id);
    await refreshPlaylists();
  };

  const drop = (event: DragEvent) => {
    event.preventDefault();
    dragging = false;
    void addFiles([...(event.dataTransfer?.files ?? [])].map((file) => api.pathForFile(file)));
  };
</script>

{#snippet badge(player: string)}
  {#if sourceKind(player) === 'local'}<span class="source local" data-tip={t('music.myFile')}>{@html pixelIcon('music')}</span>
  {:else if sourceKind(player) === 'spotify'}<span class="source spotify" data-tip="Spotify">S</span>
  {:else}<span class="source music" data-tip="Apple Music">{@html pixelIcon('music')}</span>{/if}
{/snippet}

{#snippet listOptions(current: string | null)}
  <option value="">{t('music.noList')}</option>
  {#each view.playlists as p (p.id)}<option value={p.id} selected={p.id === current}>{p.name} ({p.items.length})</option>{/each}
{/snippet}

<div class="frame well setting-group" id="now">
  {#if view.track}
    <div class="row">
      {@render badge(view.track.player)}
      <div class="grow"><div class="todo-title">{view.track.title}</div><div class="hint">{view.track.artist}{#if view.queueList}&nbsp;· {t('music.playingList', { name: view.queueList.name })}{/if}</div></div>
      <button class="icon-button" type="button" aria-label={t('music.playPause')} onclick={() => void music.toggle()}>{@html pixelIcon(view.track.state === 'playing' ? 'pause' : 'play')}</button>
    </div>
  {:else}
    <div class="hint">{t('music.idleHint')} {@html pixelIcon('music')}</div>
  {/if}
</div>
<div class="section-title">{t('music.sync')}</div>
<label class="toggle">{t('music.syncToggle')}<input type="checkbox" id="sync" checked={view.settings.musicSync} onchange={(e) => updateSettings({ musicSync: e.currentTarget.checked })} /></label>
<div class="row"><span class="field-label">{t('pomodoro.phase.focus')}</span><select id="focus-list" class="grow" onchange={(e) => updateSettings({ focusPlaylistId: e.currentTarget.value || null })}>{@render listOptions(view.settings.focusPlaylistId)}</select></div>
<div class="row"><span class="field-label">{t('music.break')}</span><select id="break-list" class="grow" onchange={(e) => updateSettings({ breakPlaylistId: e.currentTarget.value || null })}>{@render listOptions(view.settings.breakPlaylistId)}</select></div>
<div class="divider"></div>
<div class="section-title">{t('music.playlists')}</div>
<div class="row">
  <select id="list-select" class="grow" onchange={(e) => choose(e.currentTarget.value)}>
    {#each view.playlists as p (p.id)}<option value={p.id} selected={p.id === view.list?.id}>{p.name}</option>{:else}<option value="">{t('music.noPlaylists')}</option>{/each}
  </select>
  <button type="button" aria-label={t('music.playList')} data-tip={t('music.playList')} onclick={() => view.list && void playPlaylist(view.list.id)}>{@html pixelIcon('play')}</button>
  <button type="button" aria-label={t('music.deleteList')} data-tip={t('music.deleteList')} onclick={deleteList}>{@html pixelIcon('close')}</button>
</div>
<div class="row"><span class="grow"><TextInput id="new-list" maxlength={40} placeholder={t('music.newList')} bind:value={newName} onenter={createList} /></span></div>
<ul class="playlist-items drop-zone" class:dragging id="items" bind:this={items} ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={drop}>
  {#if view.list}
    {#each view.list.items as item, i (item.id)}
      <li style:color={view.queue?.playlistId === view.list.id && view.queue.index === i ? 'var(--focus)' : null}>
        {@render badge(item.player)}
        <span class="todo-title" data-tip={item.artist}>{item.title}</span>
        <span class="todo-actions" style="opacity:1">
          <button type="button" aria-label={t('todo.moveUp')} onclick={() => moveItem(item.id, -1)}>{@html pixelIcon('up')}</button>
          <button type="button" aria-label={t('todo.moveDown')} onclick={() => moveItem(item.id, 1)}>{@html pixelIcon('down')}</button>
          <button type="button" aria-label={t('music.deleteTrack')} onclick={() => removeItem(item.id)}>{@html pixelIcon('close')}</button>
        </span>
      </li>
    {:else}
      <li class="empty">{t('music.emptyList')}</li>
    {/each}
  {:else}
    <li class="empty">{t('music.noListYet')}</li>
  {/if}
</ul>
<button class="primary" type="button" id="add-files" onclick={async () => addFiles(await api.pickAudioFiles())}>＋ {t('music.addFiles')}</button>
<div class="hint">{t('music.dropHint')}</div>
<div class="stepper">
  <span>{t('music.volume')}</span>
  <input type="range" id="volume" class="grow pixel-range" min="0" max="100" step="5" bind:value={volume}
    onfocus={() => (volumeActive = true)} onblur={() => (volumeActive = false)}
    oninput={() => music.setVolume(Number(volume))} onchange={() => void updateSettings({ musicVolume: Number(volume) })} />
  <output id="volume-out">{volume}</output>
</div>
<div class="hint" id="playlist-hint">{message}</div>
<details class="external">
  <summary>{t('music.external')}</summary>
  <div class="row"><span class="grow"><TextInput id="link" placeholder={t('music.linkPlaceholder')} bind:value={link} onenter={addLink} /></span></div>
  <button type="button" onclick={addCurrent}>＋ {t('music.addCurrent')}</button>
  <div class="hint">{t('music.automationHint')}</div>
</details>

<style>
  .field-label { flex: none; min-width: 52px; }
</style>
