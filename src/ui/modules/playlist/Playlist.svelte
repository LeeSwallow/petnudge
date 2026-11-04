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
      const id = await api.db.createPlaylist('내 음악');
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
    if (!list) return flash('먼저 플레이리스트를 만들어주세요');
    if (!parsed) return flash('Spotify 트랙/앨범/플레이리스트 링크만 지원해요');
    await api.db.addPlaylistItem(list.id, { player: parsed.player, ref: parsed.ref, title: `Spotify ${parsed.kind}`, artist: parsed.ref.split(':')[2] });
    link = '';
    await refreshPlaylists();
  };

  const addCurrent = async () => {
    const list = view.list;
    const track = music.nowPlaying;
    if (!list) return flash('먼저 플레이리스트를 만들어주세요');
    if (!track || track.player === 'Local') return flash('Spotify나 Music에서 곡을 재생해주세요');
    const ok = await api.db.addPlaylistItem(list.id, track);
    flash(ok ? `“${track.title}” 추가!` : '이 곡은 추가할 수 없어요');
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
  {#if sourceKind(player) === 'local'}<span class="source local" data-tip="내 파일">{@html pixelIcon('music')}</span>
  {:else if sourceKind(player) === 'spotify'}<span class="source spotify" data-tip="Spotify">S</span>
  {:else}<span class="source music" data-tip="Apple Music">{@html pixelIcon('music')}</span>{/if}
{/snippet}

{#snippet listOptions(current: string | null)}
  <option value="">(없음 · 이어서 재생/일시정지)</option>
  {#each view.playlists as p (p.id)}<option value={p.id} selected={p.id === current}>{p.name} ({p.items.length})</option>{/each}
{/snippet}

<div class="frame well setting-group" id="now">
  {#if view.track}
    <div class="row">
      {@render badge(view.track.player)}
      <div class="grow"><div class="todo-title">{view.track.title}</div><div class="hint">{view.track.artist}{#if view.queueList}&nbsp;· {view.queueList.name} 재생 중{/if}</div></div>
      <button class="icon-button" type="button" aria-label="재생/일시정지" onclick={() => void music.toggle()}>{@html pixelIcon(view.track.state === 'playing' ? 'pause' : 'play')}</button>
    </div>
  {:else}
    <div class="hint">플레이리스트의 재생 버튼을 누르거나 타이머를 시작하면 음악이 흘러요 {@html pixelIcon('music')}</div>
  {/if}
</div>
<div class="section-title">타이머 연동</div>
<label class="toggle">집중·휴식에 맞춰 음악 자동 전환<input type="checkbox" id="sync" checked={view.settings.musicSync} onchange={(e) => updateSettings({ musicSync: e.currentTarget.checked })} /></label>
<div class="row"><span style="width:52px">집중</span><select id="focus-list" class="grow" onchange={(e) => updateSettings({ focusPlaylistId: e.currentTarget.value || null })}>{@render listOptions(view.settings.focusPlaylistId)}</select></div>
<div class="row"><span style="width:52px">휴식</span><select id="break-list" class="grow" onchange={(e) => updateSettings({ breakPlaylistId: e.currentTarget.value || null })}>{@render listOptions(view.settings.breakPlaylistId)}</select></div>
<div class="divider"></div>
<div class="section-title">플레이리스트</div>
<div class="row">
  <select id="list-select" class="grow" onchange={(e) => choose(e.currentTarget.value)}>
    {#each view.playlists as p (p.id)}<option value={p.id} selected={p.id === view.list?.id}>{p.name}</option>{:else}<option value="">플레이리스트 없음</option>{/each}
  </select>
  <button type="button" aria-label="이 목록 재생" data-tip="이 목록 재생" onclick={() => view.list && void playPlaylist(view.list.id)}>{@html pixelIcon('play')}</button>
  <button type="button" aria-label="목록 삭제" data-tip="목록 삭제" onclick={deleteList}>{@html pixelIcon('close')}</button>
</div>
<div class="row"><span class="grow"><TextInput id="new-list" maxlength={40} placeholder="새 플레이리스트 이름 (Enter)" bind:value={newName} onenter={createList} /></span></div>
<ul class="playlist-items drop-zone" class:dragging id="items" bind:this={items} ondragover={(e) => { e.preventDefault(); dragging = true; }} ondragleave={() => (dragging = false)} ondrop={drop}>
  {#if view.list}
    {#each view.list.items as item, i (item.id)}
      <li style:color={view.queue?.playlistId === view.list.id && view.queue.index === i ? 'var(--focus)' : null}>
        {@render badge(item.player)}
        <span class="todo-title" data-tip={item.artist}>{item.title}</span>
        <span class="todo-actions" style="opacity:1">
          <button type="button" aria-label="위로" onclick={() => moveItem(item.id, -1)}>{@html pixelIcon('up')}</button>
          <button type="button" aria-label="아래로" onclick={() => moveItem(item.id, 1)}>{@html pixelIcon('down')}</button>
          <button type="button" aria-label="곡 삭제" onclick={() => removeItem(item.id)}>{@html pixelIcon('close')}</button>
        </span>
      </li>
    {:else}
      <li class="empty">곡을 추가해보세요</li>
    {/each}
  {:else}
    <li class="empty">위에서 새 플레이리스트를 만들어보세요</li>
  {/if}
</ul>
<button class="primary" type="button" id="add-files" onclick={async () => addFiles(await api.pickAudioFiles())}>＋ 내 음악 파일 추가</button>
<div class="hint">파일을 목록 위로 끌어다 놓아도 돼요 (mp3·m4a·flac·wav·ogg)</div>
<div class="stepper">
  <span>볼륨</span>
  <input type="range" id="volume" class="grow pixel-range" min="0" max="100" step="5" bind:value={volume}
    onfocus={() => (volumeActive = true)} onblur={() => (volumeActive = false)}
    oninput={() => music.setVolume(Number(volume))} onchange={() => void updateSettings({ musicVolume: Number(volume) })} />
  <output id="volume-out">{volume}</output>
</div>
<div class="hint" id="playlist-hint">{message}</div>
<details class="external">
  <summary>외부 플레이어 연동 (선택 · macOS)</summary>
  <div class="row"><span class="grow"><TextInput id="link" placeholder="Spotify 링크 붙여넣기 (Enter)" bind:value={link} onenter={addLink} /></span></div>
  <button type="button" onclick={addCurrent}>＋ Spotify/Music에서 지금 재생 중인 곡 추가</button>
  <div class="hint">처음 연결할 때 macOS가 "자동화" 권한을 물어봐요.</div>
</details>
