import { api } from '../api';
import { pack } from '../character';
import { esc } from '../charts';
import {
  activeSession, cancelChat, chatAvailable, chatState, deleteSession, friendsOnScreen, inviteToSession, membersOf, nameOf, newSession,
  onChat, openSession, providerLabel, removeFromSession, renameSession, sendChat, sessionById, sessionsFor, setMirror, talkTogether,
  type ChatSession
} from '../chat';
import { PROVIDER_INFO, routeFor } from '../../shared/chat';
import type { CharacterChoice } from '../../shared/characterImport';
import type { ChatMessage } from '../../shared/chat';
import { $, onAction, onEnter, type PanelModule } from './module';

// The 대화 tab, like a messenger: each character is a friend you can unfold
// to see your sessions with them; opening one shows the conversation.

let root: HTMLElement;
let friends: CharacterChoice[] = [];
let open: string | null = null; // session shown, or the friend list
const unfolded = new Set<string>();
let confirmDelete: string | null = null;

const when = (time: number) => {
  const d = new Date(time);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return d.getFullYear() === today.getFullYear() ? `${d.getMonth() + 1}.${d.getDate()}` : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

const preview = (session: ChatSession) => {
  const last = [...session.messages].reverse().find((m) => m.role !== 'tool');
  return last ? `${last.role === 'user' ? '나: ' : ''}${last.text}` : '아직 대화가 없어요';
};

const renderFriends = () => {
  const list = $(root, '#chat-friends');
  const ids = [...new Set([pack.id, ...friends.map((f) => f.id), ...chatState.sessions.map((s) => s.characterId)])];
  list.innerHTML = ids.map((id) => {
    const name = id === pack.id ? pack.name : friends.find((f) => f.id === id)?.name ?? id;
    const sessions = sessionsFor(id);
    const isOpen = unfolded.has(id);
    const latest = sessions[0];
    return `
      <li class="chat-friend ${isOpen ? 'open' : ''}">
        <button type="button" class="chat-friend-head" data-action="fold" data-id="${esc(id)}" aria-expanded="${isOpen}">
          <span class="chat-caret">${isOpen ? '▾' : '▸'}</span>
          <span class="chat-friend-name">${esc(name)}${id === pack.id ? ' <small>지금 펫</small>' : ''}</span>
          <span class="chat-friend-meta">${sessions.length ? `대화 ${sessions.length}` : ''}${latest ? ` · ${when(latest.updatedAt)}` : ''}</span>
        </button>
        ${isOpen ? `<ul class="chat-sessions">
          ${sessions.map((s) => `
            <li class="chat-session-row">
              <button type="button" class="chat-session" data-action="open" data-id="${s.id}">
                <b>${esc(s.title)}</b><span>${esc(preview(s))}</span>
              </button>
              <span class="chat-session-when">${when(s.updatedAt)}</span>
              <button type="button" class="icon-button ghost" data-action="delete" data-id="${s.id}" aria-label="대화 삭제">${confirmDelete === s.id ? '?' : '×'}</button>
            </li>`).join('')}
          <li><button type="button" class="chat-new" data-action="new" data-id="${esc(id)}">+ 새 대화</button></li>
        </ul>` : ''}
      </li>`;
  }).join('');
};

const bubble = (message: ChatMessage, extra = '', group = false) => {
  const who = group && message.role === 'pet' && message.speaker ? `<span class="chat-who">${esc(nameOf(message.speaker))}</span>` : '';
  const guest = message.speaker?.startsWith('guest:') ? ' guest' : '';
  return `<li class="chat-bubble ${message.role}${guest} ${extra}">${who}${esc(message.text)}</li>`;
};

// Members, invites and the "talk among yourselves" controls of a session.
const renderMembers = (session: ChatSession) => {
  const members = membersOf(session);
  const busy = Boolean(chatState.busy);
  const invitable = friends.filter((f) => !members.includes(f.id));
  const chip = (id: string) => {
    const route = routeFor(chatState.config, id);
    const out = id !== pack.id && friendsOnScreen.has(id);
    return `<span class="chat-member" data-tip="${esc(PROVIDER_INFO[route.provider].label)}${route.model ? ` · ${esc(route.model)}` : ''}">
      ${esc(nameOf(id))}<small>${esc(PROVIDER_INFO[route.provider].label)}</small>
      ${id !== pack.id ? `<button type="button" class="ghost mini" data-action="desk" data-id="${esc(id)}">${out ? '돌려보내기' : '화면에 부르기'}</button>` : ''}
      ${id !== session.characterId ? `<button type="button" class="ghost mini" data-action="kick" data-id="${esc(id)}" aria-label="내보내기">×</button>` : ''}
    </span>`;
  };
  $(root, '#chat-members').innerHTML = `
    <div class="chat-member-list">${members.map(chip).join('')}</div>
    <div class="row">
      ${invitable.length ? `<select id="chat-invite" aria-label="친구 초대"><option value="">＋ 친구 초대</option>${invitable.map((f) => `<option value="${esc(f.id)}">${esc(f.name)}</option>`).join('')}</select>` : ''}
      ${members.length > 1 ? `<select id="chat-turns" aria-label="몇 마디">${[4, 6, 10].map((n) => `<option value="${n}" ${n === 6 ? 'selected' : ''}>${n}마디</option>`).join('')}</select>
        <button type="button" data-action="together" ${busy ? 'disabled' : ''} data-tip="입력칸 내용을 주제로, 비어 있으면 자유롭게">서로 대화</button>
        <label class="toggle mini">말풍선<input type="checkbox" id="chat-mirror" ${session.mirror !== false ? 'checked' : ''} /></label>` : ''}
    </div>`;
};

const renderSession = (session: ChatSession) => {
  const pending = chatState.pending?.sessionId === session.id;
  const busy = chatState.busy === session.id;
  const name = session.characterId === pack.id ? pack.name : friends.find((f) => f.id === session.characterId)?.name ?? session.characterId;
  $(root, '#chat-title').innerHTML = `<input type="text" id="chat-title-input" value="${esc(session.title)}" maxlength="40" aria-label="대화 제목" /><small>${esc(name)} · ${providerLabel()}</small>`;
  const log = $(root, '#chat-log');
  const group = membersOf(session).length > 1 || session.messages.some((m) => m.speaker?.startsWith('guest:'));
  renderMembers(session);
  const items = session.messages.map((m) => bubble(m, '', group));
  if (pending) items.push(bubble({ role: 'pet', text: chatState.live || '…', speaker: chatState.pending?.speaker }, chatState.live ? '' : 'thinking', group));
  if (items.length === 0) items.push(`<li class="chat-bubble system">${esc(name)}에게 말을 걸어 봐요. 할 일 추가, 메모 정리, 타이머도 부탁할 수 있어요.</li>`);
  log.innerHTML = items.join('');
  log.scrollTo({ top: log.scrollHeight });
  const input = $<HTMLInputElement>(root, '#chat-input');
  const none = chatState.providers.length > 0 && !chatAvailable();
  input.disabled = Boolean(chatState.busy) || none;
  input.placeholder = none ? '설정 › AI 대화 설정에서 연결해 주세요' : membersOf(session).length > 1 ? '모두에게 · @이름 으로 한 명만' : `${name}에게 메시지`;
  $(root, '#chat-send').textContent = busy ? '멈춤' : '보내기';
};

const render = () => {
  const session = open ? sessionById(open) : undefined;
  if (open && !session) open = null;
  $(root, '#chat-list-view').hidden = Boolean(session);
  $(root, '#chat-session-view').hidden = !session;
  if (session) renderSession(session);
  else renderFriends();
};

const send = () => {
  if (chatState.busy) return cancelChat();
  const input = $<HTMLInputElement>(root, '#chat-input');
  const text = input.value;
  input.value = '';
  void sendChat(text, open ?? undefined);
};

export const chatModule: PanelModule = {
  id: 'chat',
  label: '대화',
  icon: 'talk',
  watches: ['settings'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div id="chat-list-view">
        <div class="row chat-top">
          <span class="hint grow">친구를 펼쳐서 대화를 골라요</span>
        </div>
        <ul class="chat-friends" id="chat-friends"></ul>
      </div>
      <div id="chat-session-view" hidden>
        <div class="row chat-top">
          <button type="button" class="icon-button" data-action="back" aria-label="목록으로">‹</button>
          <div class="chat-title grow" id="chat-title"></div>
        </div>
        <div class="chat-members" id="chat-members"></div>
        <ul class="chat-log" id="chat-log" aria-live="polite"></ul>
        <div class="row">
          <input type="text" id="chat-input" class="grow" maxlength="2000" autocomplete="off" />
          <button type="button" id="chat-send" data-action="send">보내기</button>
        </div>
      </div>`;
    onEnter($<HTMLInputElement>(root, '#chat-input'), send);
    onAction(root, {
      send,
      back: () => { open = null; render(); },
      fold: (target) => {
        const id = target.dataset.id!;
        if (unfolded.has(id)) unfolded.delete(id); else unfolded.add(id);
        render();
      },
      open: (target) => { open = target.dataset.id!; openSession(open); render(); $<HTMLInputElement>(root, '#chat-input').focus(); },
      new: (target) => { open = newSession(target.dataset.id!).id; render(); $<HTMLInputElement>(root, '#chat-input').focus(); },
      kick: (target) => { if (open) removeFromSession(open, target.dataset.id!); },
      desk: async (target) => {
        const id = target.dataset.id!;
        if (friendsOnScreen.has(id)) api.closeFriend(id);
        else await api.openFriend(id).catch(() => undefined);
      },
      together: () => {
        if (!open) return;
        const input = $<HTMLInputElement>(root, '#chat-input');
        const topic = input.value;
        input.value = '';
        void talkTogether(open, Number($<HTMLSelectElement>(root, '#chat-turns').value), topic);
      },
      delete: (target) => {
        const id = target.dataset.id!;
        if (confirmDelete === id) { confirmDelete = null; deleteSession(id); }
        else { confirmDelete = id; render(); setTimeout(() => { if (confirmDelete === id) { confirmDelete = null; render(); } }, 3000); }
      }
    });
    root.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.id === 'chat-title-input' && open) renameSession(open, input.value);
      if (input.id === 'chat-invite' && open && input.value) inviteToSession(open, input.value);
      if (input.id === 'chat-mirror' && open) setMirror(open, input.checked);
    });
    onChat(() => { if (!root.hidden) render(); });
  },

  render() {
    void api.listCharacters().then((list) => { friends = list; if (!open) renderFriends(); });
    // Opening the tab shows her current conversation.
    if (open === null && !unfolded.size) unfolded.add(pack.id);
    render();
  }
};

// The quick bar's "크게 보기": open the tab on her current session.
export const showActiveSession = () => { open = activeSession().id; };
