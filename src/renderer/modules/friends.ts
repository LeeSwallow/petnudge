import { api } from '../api';
import { pack } from '../character';
import { esc } from '../charts';
import type { CharacterChoice } from '../../shared/characterImport';
import { $, onAction, type PanelModule } from './module';

// The 캐릭터 tab: who is out on the desktop. The main pet always stays (it is
// picked in 설정); every other character can be called out as a friend window
// (main/friends.ts) or sent back.

let root: HTMLElement;
let characters: CharacterChoice[] = [];
let out: string[] = [];

const row = (c: CharacterChoice) => {
  const main = c.id === pack.id;
  const shown = main || out.includes(c.id);
  const action = main
    ? '<span class="hint">대표</span>'
    : `<button type="button" class="${shown ? 'ghost ' : ''}mini" data-action="${shown ? 'remove' : 'add'}" data-id="${esc(c.id)}">${shown ? '돌려보내기' : '화면에 부르기'}</button>`;
  return `<li class="row"><span class="grow">${esc(c.name)}${c.builtin ? ' <small class="hint">기본</small>' : ''}</span>${action}</li>`;
};

const render = () => {
  const count = 1 + out.filter((id) => id !== pack.id).length;
  $(root, '#friends-count').textContent = `화면에 ${count}마리`;
  $(root, '#friends-list').innerHTML = characters.map(row).join('');
  $<HTMLButtonElement>(root, '[data-action="clear"]').disabled = count === 1;
};

const refresh = async () => {
  try {
    [characters, out] = await Promise.all([api.listCharacters(), api.listFriends()]);
    $(root, '#friends-status').textContent = '';
  } catch (error) {
    $(root, '#friends-status').textContent = error instanceof Error ? error.message : '캐릭터 목록을 읽지 못했어요';
  }
  render();
};

export const friendsModule: PanelModule = {
  id: 'friends',
  label: '캐릭터',
  icon: 'happy',
  watches: ['settings'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="section-title">화면의 캐릭터 <small id="friends-count"></small></div>
      <div class="frame well setting-group">
        <ul class="friends-list" id="friends-list"></ul>
        <button type="button" data-action="clear">대표만 남기기</button>
        <div class="hint">대표 캐릭터는 설정에서 바꿔요. 부른 친구는 다음에 켤 때 다시 나오지 않아요.</div>
        <div class="hint" id="friends-status" role="status" aria-live="polite"></div>
      </div>`;
    onAction(root, {
      add: (target) => {
        api.openFriend(target.dataset.id!).catch((error) => {
          $(root, '#friends-status').textContent = error instanceof Error ? error.message : '부르지 못했어요';
        });
      },
      remove: (target) => api.closeFriend(target.dataset.id!),
      clear: () => out.forEach((id) => api.closeFriend(id))
    });
    api.onFriends((ids) => {
      out = ids;
      if (!root.hidden) render();
    });
    void refresh();
  },

  render: () => void refresh()
};
