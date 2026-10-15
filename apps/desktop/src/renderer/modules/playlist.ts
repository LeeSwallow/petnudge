import { pixelIcon } from '../icons';
import { api } from '../api';
import { esc } from '../charts';
import { data, refreshPlaylists, updateSettings } from '../data';
import { enter } from '../fx';
import { music, playPlaylist } from '../music';
import { parseMusicLink } from '../../shared/music';
import { $, onAction, onEnter, type PanelModule } from './module';

let root: HTMLElement;
let selectedId: string | null = null;
let message = '';

const sourceBadge = (player: string) =>
  player === 'Local'
    ? `<span class="source local" data-tip="내 파일">${pixelIcon('music')}</span>`
    : player === 'Spotify'
      ? `<span class="source spotify" data-tip="Spotify">S</span>`
      : `<span class="source music" data-tip="Apple Music">${pixelIcon('music')}</span>`;

const selected = () => data.playlists.find((p) => p.id === selectedId) ?? data.playlists[0] ?? null;

const flash = (text: string) => {
  message = text;
  playlistModule.render();
  setTimeout(() => {
    if (message === text) {
      message = '';
      playlistModule.render();
    }
  }, 2500);
};

export const playlistModule: PanelModule = {
  id: 'playlist',
  label: '음악',
  icon: 'music',
  watches: ['playlists', 'settings', 'music'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="frame well setting-group" id="now"></div>
      <div class="section-title">타이머 연동</div>
      <label class="toggle">집중·휴식에 맞춰 음악 자동 전환<input type="checkbox" id="sync" /></label>
      <div class="row"><span style="width:52px">집중</span><select id="focus-list" class="grow"></select></div>
      <div class="row"><span style="width:52px">휴식</span><select id="break-list" class="grow"></select></div>
      <div class="divider"></div>
      <div class="section-title">플레이리스트</div>
      <div class="row">
        <select id="list-select" class="grow"></select>
        <button type="button" aria-label="이 목록 재생" data-action="play-list" data-tip="이 목록 재생">${pixelIcon('play')}</button>
        <button type="button" aria-label="목록 삭제" data-action="delete-list" data-tip="목록 삭제">${pixelIcon('close')}</button>
      </div>
      <div class="row"><input type="text" id="new-list" class="grow" maxlength="40" placeholder="새 플레이리스트 이름 (Enter)" /></div>
      <ul class="playlist-items drop-zone" id="items"></ul>
      <button class="primary" type="button" data-action="add-files">＋ 내 음악 파일 추가</button>
      <div class="hint">파일을 목록 위로 끌어다 놓아도 돼요 (mp3·m4a·flac·wav·ogg)</div>
      <div class="stepper"><span>볼륨</span><input type="range" id="volume" class="grow pixel-range" min="0" max="100" step="5" /><output id="volume-out"></output></div>
      <div class="hint" id="playlist-hint"></div>
      <details class="external">
        <summary>외부 플레이어 연동 (선택 · macOS)</summary>
        <div class="row"><input type="text" id="link" class="grow" placeholder="Spotify 링크 붙여넣기 (Enter)" /></div>
        <button type="button" data-action="add-current">＋ Spotify/Music에서 지금 재생 중인 곡 추가</button>
        <div class="hint">처음 연결할 때 macOS가 "자동화" 권한을 물어봐요.</div>
      </details>`;

    $<HTMLInputElement>(root, '#sync').addEventListener('change', (e) =>
      updateSettings({ musicSync: (e.target as HTMLInputElement).checked })
    );
    $<HTMLSelectElement>(root, '#focus-list').addEventListener('change', (e) =>
      updateSettings({ focusPlaylistId: (e.target as HTMLSelectElement).value || null })
    );
    $<HTMLSelectElement>(root, '#break-list').addEventListener('change', (e) =>
      updateSettings({ breakPlaylistId: (e.target as HTMLSelectElement).value || null })
    );
    $<HTMLSelectElement>(root, '#list-select').addEventListener('change', (e) => {
      selectedId = (e.target as HTMLSelectElement).value;
      playlistModule.render();
      enter($(root, '#items'), 'settle');
    });

    const newList = $<HTMLInputElement>(root, '#new-list');
    onEnter(newList, async () => {
      const id = await api.db.createPlaylist(newList.value);
      if (!id) return;
      newList.value = '';
      selectedId = id;
      await refreshPlaylists();
    });

    const volume = $<HTMLInputElement>(root, '#volume');
    volume.addEventListener('input', () => {
      music.setVolume(Number(volume.value));
      $(root, '#volume-out').textContent = volume.value;
    });
    volume.addEventListener('change', () => void updateSettings({ musicVolume: Number(volume.value) }));

    const items = $(root, '#items');
    items.addEventListener('dragover', (event) => {
      event.preventDefault();
      items.classList.add('dragging');
    });
    items.addEventListener('dragleave', () => items.classList.remove('dragging'));
    items.addEventListener('drop', (event) => {
      event.preventDefault();
      items.classList.remove('dragging');
      const paths = [...(event.dataTransfer?.files ?? [])].map((file) => api.pathForFile(file));
      void addFiles(paths);
    });

    const link = $<HTMLInputElement>(root, '#link');
    onEnter(link, async () => {
      const list = selected();
      const parsed = parseMusicLink(link.value);
      if (!list) return flash('먼저 플레이리스트를 만들어주세요');
      if (!parsed) return flash('Spotify 트랙/앨범/플레이리스트 링크만 지원해요');
      await api.db.addPlaylistItem(list.id, { player: parsed.player, ref: parsed.ref, title: `Spotify ${parsed.kind}`, artist: parsed.ref.split(':')[2] });
      link.value = '';
      await refreshPlaylists();
    });

    const addFiles = async (paths: string[]) => {
      let list = selected();
      if (!list) {
        const id = await api.db.createPlaylist('내 음악');
        await refreshPlaylists();
        selectedId = id;
        list = selected();
      }
      if (!list) return;
      let added = 0;
      for (const path of paths) {
        const name = path.split(/[\\/]/).pop() ?? path;
        if (await api.db.addPlaylistItem(list.id, { player: 'Local', ref: path, title: name.replace(/\.[^.]+$/, ''), artist: '내 파일' })) added += 1;
      }
      await refreshPlaylists();
      flash(added ? `${added}곡 추가했어요` : '지원하는 음악 파일이 없어요');
    };

    onAction(root, {
      'add-files': async () => addFiles(await api.pickAudioFiles()),
      'toggle-play': () => void music.toggle(),
      'play-list': () => {
        const list = selected();
        if (list) void playPlaylist(list.id);
      },
      'delete-list': async () => {
        const list = selected();
        if (!list) return;
        await api.db.deletePlaylist(list.id);
        selectedId = null;
        await Promise.all([refreshPlaylists(), updateSettings({})]);
      },
      'add-current': async () => {
        const list = selected();
        const track = music.nowPlaying;
        if (!list) return flash('먼저 플레이리스트를 만들어주세요');
        if (!track || track.player === 'Local') return flash('Spotify나 Music에서 곡을 재생해주세요');
        const ok = await api.db.addPlaylistItem(list.id, track);
        flash(ok ? `“${track.title}” 추가!` : '이 곡은 추가할 수 없어요');
        await refreshPlaylists();
      },
      'item-up': async (t) => {
        await api.db.movePlaylistItem(t.dataset.id!, -1);
        await refreshPlaylists();
      },
      'item-down': async (t) => {
        await api.db.movePlaylistItem(t.dataset.id!, 1);
        await refreshPlaylists();
      },
      'item-remove': async (t) => {
        await api.db.removePlaylistItem(t.dataset.id!);
        await refreshPlaylists();
      }
    });
  },

  render() {
    const { settings, playlists } = data;
    const track = music.nowPlaying;
    const queueList = music.queue ? playlists.find((p) => p.id === music.queue!.playlistId) : null;
    $(root, '#now').innerHTML = track
      ? `<div class="row">${sourceBadge(track.player)}
           <div class="grow"><div class="todo-title">${esc(track.title)}</div><div class="hint">${esc(track.artist)}${queueList ? ` · ${esc(queueList.name)} 재생 중` : ''}</div></div>
           <button class="icon-button" type="button" aria-label="재생/일시정지" data-action="toggle-play">${pixelIcon(track.state === 'playing' ? 'pause' : 'play')}</button></div>`
      : `<div class="hint">플레이리스트의 재생 버튼을 누르거나 타이머를 시작하면 음악이 흘러요 ${pixelIcon('music')}</div>`;

    $<HTMLInputElement>(root, '#sync').checked = settings.musicSync;
    const options = (current: string | null) =>
      `<option value="">(없음 · 이어서 재생/일시정지)</option>` +
      playlists.map((p) => `<option value="${p.id}" ${p.id === current ? 'selected' : ''}>${esc(p.name)} (${p.items.length})</option>`).join('');
    $(root, '#focus-list').innerHTML = options(settings.focusPlaylistId);
    $(root, '#break-list').innerHTML = options(settings.breakPlaylistId);

    const list = selected();
    selectedId = list?.id ?? null;
    $(root, '#list-select').innerHTML = playlists.length
      ? playlists.map((p) => `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')
      : `<option value="">플레이리스트 없음</option>`;

    $(root, '#items').innerHTML = list
      ? list.items.length
        ? list.items
            .map(
              (item, i) => `<li ${music.queue?.playlistId === list.id && music.queue.index === i ? 'style="color:var(--focus)"' : ''}>
                ${sourceBadge(item.player)}
                <span class="todo-title" data-tip="${esc(item.artist)}">${esc(item.title)}</span>
                <span class="todo-actions" style="opacity:1">
                  <button type="button" aria-label="위로" data-action="item-up" data-id="${item.id}">${pixelIcon('up')}</button>
                  <button type="button" aria-label="아래로" data-action="item-down" data-id="${item.id}">${pixelIcon('down')}</button>
                  <button type="button" aria-label="곡 삭제" data-action="item-remove" data-id="${item.id}">${pixelIcon('close')}</button>
                </span></li>`
            )
            .join('')
        : `<li class="empty">곡을 추가해보세요</li>`
      : `<li class="empty">위에서 새 플레이리스트를 만들어보세요</li>`;

    $(root, '#playlist-hint').textContent = message;
    const volume = $<HTMLInputElement>(root, '#volume');
    if (document.activeElement !== volume) volume.value = String(settings.musicVolume);
    $(root, '#volume-out').textContent = String(settings.musicVolume);
  }
};
