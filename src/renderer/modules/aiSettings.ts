import { api } from '../api';
import { pack } from '../character';
import { esc } from '../charts';
import { data } from '../data';
import { chatState, clearAllSessions, onChat, refreshChatProviders, saveChatConfig, testChat } from '../chat';
import {
  CHAT_PROVIDERS, DEFAULT_BASE_PROMPT, PROVIDER_INFO, buildSystemPrompt, modelFor, profileSchema,
  type ChatProfile, type ChatProvider, type ToolGroup
} from '../../shared/chat';
import type { CharacterChoice } from '../../shared/characterImport';
import { $, onAction } from './module';

// Settings › AI 대화 설정: its own page inside the settings tab, since there
// is a lot to set — the provider and keys, which tools she may use, each
// character's chat profile and the base prompt.

const GROUPS: Record<ToolGroup, string> = {
  info: '기본', chat: '대화 세션', todos: '할 일', notes: '메모', timer: '타이머', stats: '통계', settings: '설정', music: '음악', pet: '펫·캐릭터·모드'
};

let root: HTMLElement;
let characters: CharacterChoice[] = [];
let profileId = '';
let confirmClear = false;

const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);

const profile = (): ChatProfile => profileSchema.parse(chatState.config.profiles[profileId] ?? {});
const saveProfile = (patch: Partial<ChatProfile>) =>
  saveChatConfig({ profiles: { ...chatState.config.profiles, [profileId]: { ...profile(), ...patch } } });

const renderProviders = () => {
  const { config, providers } = chatState;
  $(root, '#ai-providers').innerHTML = CHAT_PROVIDERS.map((id) => {
    const info = PROVIDER_INFO[id];
    const state = providers.find((p) => p.id === id);
    const selected = config.provider === id;
    const status = info.kind === 'cli'
      ? state?.available ? `✓ ${esc(state.path ?? '설치됨')}` : '✗ 설치 안 됨'
      : state?.hasKey ? '✓ 키 저장됨' : info.needsKey ? '키 필요' : '키 없이 사용 가능';
    return `
      <li class="ai-provider ${selected ? 'selected' : ''}">
        <label class="ai-provider-head">
          <input type="radio" name="ai-provider" value="${id}" ${selected ? 'checked' : ''} />
          <b>${info.label}</b><small class="${state?.available ? 'ok' : ''}">${status}</small>
        </label>
        ${selected ? `
          <div class="hint">${esc(info.hint)}</div>
          <div class="row"><span class="ai-label">모델</span><input type="text" data-model="${id}" class="grow" value="${esc(config.models[id] ?? '')}" placeholder="${esc(info.model || '기본 모델')}" /></div>
          ${id === 'custom' ? `<div class="row"><span class="ai-label">주소</span><input type="text" id="ai-base-url" class="grow" value="${esc(config.baseUrl)}" /></div>` : ''}
          ${info.kind === 'api' ? `<div class="row"><span class="ai-label">API 키</span><input type="password" data-key="${id}" class="grow" placeholder="${state?.hasKey ? '저장됨 · 바꾸려면 새로 입력' : '붙여넣기'}" autocomplete="off" /><button type="button" data-action="save-key" data-id="${id}">저장</button>${state?.hasKey ? `<button type="button" class="ghost" data-action="remove-key" data-id="${id}">삭제</button>` : ''}</div>` : ''}
        ` : ''}
      </li>`;
  }).join('');
};

const renderTools = () => {
  const { tools: settings } = chatState.config;
  $<HTMLInputElement>(root, '#ai-tools-on').checked = settings.enabled;
  $<HTMLInputElement>(root, '#ai-tools-write').checked = settings.allowWrite;
  const groups = new Map<ToolGroup, typeof chatState.tools>();
  for (const tool of chatState.tools) groups.set(tool.group, [...(groups.get(tool.group) ?? []), tool]);
  $(root, '#ai-tool-list').innerHTML = [...groups].map(([group, tools]) => `
    <div class="ai-tool-group"><div class="ai-tool-title">${GROUPS[group]}</div>
      ${tools.map((t) => `<label class="ai-tool ${settings.enabled && (!t.write || settings.allowWrite) ? '' : 'off'}" data-tip="${esc(t.description)}">
        <input type="checkbox" data-tool="${t.name}" ${settings.disabled.includes(t.name) ? '' : 'checked'} ${settings.enabled ? '' : 'disabled'} />
        ${esc(t.label)}${t.write ? ' <small>변경</small>' : ''}</label>`).join('')}
    </div>`).join('');
};

const renderProfile = () => {
  const select = $<HTMLSelectElement>(root, '#ai-profile-character');
  const ids = characters.length ? characters : [{ id: pack.id, name: pack.name } as CharacterChoice];
  if (!profileId || !ids.some((c) => c.id === profileId)) profileId = pack.id;
  select.innerHTML = ids.map((c) => `<option value="${esc(c.id)}" ${c.id === profileId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  const p = profile();
  const provider = $<HTMLSelectElement>(root, '#ai-profile-provider');
  provider.innerHTML = `<option value="">기본 (${PROVIDER_INFO[chatState.config.provider].label})</option>` +
    CHAT_PROVIDERS.map((id) => `<option value="${id}" ${p.provider === id ? 'selected' : ''}>${PROVIDER_INFO[id].label}</option>`).join('');
  $(root, '#ai-profile-model-row').hidden = !p.provider;
  const model = $<HTMLInputElement>(root, '#ai-profile-model');
  if (document.activeElement !== model) model.value = p.model ?? '';
  model.placeholder = p.provider ? modelFor(chatState.config, p.provider) || '기본 모델' : '';
  const name = ids.find((c) => c.id === profileId)?.name ?? profileId;
  const persona = $<HTMLTextAreaElement>(root, '#ai-persona');
  if (document.activeElement !== persona) persona.value = p.persona ?? '';
  persona.placeholder = profileId === pack.id && pack.persona ? `캐릭터 기본값: ${pack.persona}` : '예: 밝고 장난기 많지만 공부는 꼼꼼히 챙겨 주는 친구';
  root.querySelectorAll<HTMLButtonElement>('[data-speech]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.speech === p.speech)));
  root.querySelectorAll<HTMLButtonElement>('[data-length]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.length === p.length)));
  const call = $<HTMLInputElement>(root, '#ai-call');
  if (document.activeElement !== call) call.value = p.callUser ?? '';
  call.placeholder = data.settings.nickname || '닉네임 (프로필 설정)';
  $<HTMLInputElement>(root, '#ai-emoji').checked = p.emoji;
  const extra = $<HTMLTextAreaElement>(root, '#ai-extra');
  if (document.activeElement !== extra) extra.value = p.extra ?? '';
  $(root, '#ai-preview').textContent = buildSystemPrompt(chatState.config, {
    characterId: profileId, character: name, packPersona: profileId === pack.id ? pack.persona : undefined,
    nickname: data.settings.nickname || undefined, status: '(보낼 때의 시간·타이머·할 일·음악)'
  });
};

const render = () => {
  if (!root || root.hidden) return;
  renderProviders();
  renderTools();
  renderProfile();
  const base = $<HTMLTextAreaElement>(root, '#ai-base');
  if (document.activeElement !== base) base.value = chatState.config.basePrompt;
  $<HTMLInputElement>(root, '#ai-button').checked = chatState.config.button;
  $(root, '#ai-sessions').textContent = `저장된 대화 ${chatState.sessions.length}개`;
  $(root, '#ai-clear').textContent = confirmClear ? '정말 모두 지울까요?' : '모든 대화 지우기';
};

export const mountAiSettings = (el: HTMLElement, onBack: () => void) => {
  root = el;
  root.innerHTML = `
    <div class="row chat-top"><button type="button" class="icon-button" data-action="ai-back" aria-label="설정으로">‹</button><b class="grow">AI 대화 설정</b></div>

    <div class="section-title">연결 <small>누가 대답할지</small></div>
    <div class="frame well setting-group">
      <ul class="ai-providers" id="ai-providers"></ul>
      <div class="row">
        <button type="button" data-action="ai-refresh" class="grow">다시 찾기</button>
        <button type="button" data-action="ai-test" class="grow">연결 테스트</button>
      </div>
      <div class="hint" id="ai-status" role="status" aria-live="polite">API 키는 이 컴퓨터의 키체인으로 암호화해서 저장하고, 화면으로는 다시 보내지 않아요.</div>
    </div>

    <div class="section-title">도구 <small>대화로 앱 다루기</small></div>
    <div class="frame well setting-group">
      <label class="toggle">도구 사용<input type="checkbox" id="ai-tools-on" /></label>
      <label class="toggle">추가·수정·삭제 허용<input type="checkbox" id="ai-tools-write" /></label>
      <div id="ai-tool-list" class="ai-tool-list"></div>
      <div class="hint">"할 일에 미적분 추가해 줘", "오늘 메모 정리해 줘", "25분 집중 시작" 처럼 부탁하면 직접 처리해요.</div>
    </div>

    <div class="section-title">캐릭터 프로필 <small>말투·성격</small></div>
    <div class="frame well setting-group">
      <div class="row"><span class="ai-label">캐릭터</span><select id="ai-profile-character" class="grow"></select></div>
      <div class="row"><span class="ai-label">대답할 AI</span><select id="ai-profile-provider" class="grow"></select></div>
      <div class="row" id="ai-profile-model-row"><span class="ai-label">모델</span><input type="text" id="ai-profile-model" class="grow" maxlength="120" /></div>
      <div class="hint">캐릭터마다 다른 AI를 정하면, 그룹 대화나 "서로 대화"에서 서로 다른 LLM끼리 이야기해요.</div>
      <label class="ai-field">성격·말투<textarea id="ai-persona" rows="3" maxlength="800"></textarea></label>
      <div class="row"><span class="ai-label">높임</span>
        <div class="segmented grow"><button type="button" data-action="speech" data-speech="banmal">반말</button><button type="button" data-action="speech" data-speech="jondaet">존댓말</button></div></div>
      <div class="row"><span class="ai-label">길이</span>
        <div class="segmented grow"><button type="button" data-action="length" data-length="short">짧게</button><button type="button" data-action="length" data-length="normal">보통</button><button type="button" data-action="length" data-length="long">자세히</button></div></div>
      <div class="row"><span class="ai-label">부를 이름</span><input type="text" id="ai-call" class="grow" maxlength="40" /></div>
      <label class="toggle">이모지 쓰기<input type="checkbox" id="ai-emoji" /></label>
      <label class="ai-field">추가 지시<textarea id="ai-extra" rows="2" maxlength="2000" placeholder="예: 영어 단어는 예문과 함께 알려 줘"></textarea></label>
      <div class="row"><button type="button" class="ghost grow" data-action="profile-reset">이 캐릭터 프로필 초기화</button></div>
      <details class="ai-preview-box"><summary>프롬프트 미리보기</summary><pre id="ai-preview"></pre></details>
    </div>

    <div class="section-title">기본 프롬프트 <small>모든 캐릭터 공통</small></div>
    <div class="frame well setting-group">
      <textarea id="ai-base" rows="6" maxlength="4000"></textarea>
      <div class="row"><button type="button" class="ghost grow" data-action="base-reset">기본값으로</button></div>
    </div>

    <div class="section-title">대화</div>
    <div class="frame well setting-group">
      <label class="toggle">펫 옆 말 걸기 버튼<input type="checkbox" id="ai-button" /></label>
      <div class="row"><span class="hint grow" id="ai-sessions"></span><button type="button" class="ghost" id="ai-clear" data-action="clear-all"></button></div>
    </div>`;

  const status = (text: string) => ($(root, '#ai-status').textContent = text);

  onAction(root, {
    'ai-back': onBack,
    'ai-refresh': async () => { status('찾는 중…'); await refreshChatProviders(true); status('다시 찾았어요'); },
    'ai-test': async (target) => {
      const button = target as HTMLButtonElement;
      button.disabled = true;
      status(`${PROVIDER_INFO[chatState.config.provider].label}에 물어보는 중…`);
      try {
        const { reply, ms } = await testChat();
        status(`✓ 연결됨 (${(ms / 1000).toFixed(1)}초, ${modelFor(chatState.config) || '기본 모델'}) · "${reply.slice(0, 40)}"`);
      } catch (error) {
        status(`✗ ${errorText(error)}`);
      } finally {
        button.disabled = false;
      }
    },
    'save-key': async (target) => {
      const id = target.dataset.id as ChatProvider;
      const input = root.querySelector<HTMLInputElement>(`[data-key="${id}"]`)!;
      if (!input.value.trim()) return status('키를 붙여넣어 주세요');
      try {
        await api.setChatKey(id, input.value);
        input.value = '';
        await refreshChatProviders(false);
        status('키를 저장했어요');
      } catch (error) { status(`✗ ${errorText(error)}`); }
    },
    'remove-key': async (target) => {
      await api.setChatKey(target.dataset.id as ChatProvider, '');
      await refreshChatProviders(false);
      status('키를 지웠어요');
    },
    speech: (target) => saveProfile({ speech: target.dataset.speech as ChatProfile['speech'] }),
    length: (target) => saveProfile({ length: target.dataset.length as ChatProfile['length'] }),
    'profile-reset': () => {
      const profiles = { ...chatState.config.profiles };
      delete profiles[profileId];
      saveChatConfig({ profiles });
    },
    'base-reset': () => saveChatConfig({ basePrompt: DEFAULT_BASE_PROMPT }),
    'clear-all': () => {
      if (!confirmClear) {
        confirmClear = true;
        render();
        setTimeout(() => { confirmClear = false; render(); }, 3000);
        return;
      }
      confirmClear = false;
      clearAllSessions();
    }
  });

  root.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    const { config } = chatState;
    if (input.name === 'ai-provider') saveChatConfig({ provider: input.value as ChatProvider });
    else if (input.dataset.model) saveChatConfig({ models: { ...config.models, [input.dataset.model]: input.value.trim() } });
    else if (input.id === 'ai-base-url') saveChatConfig({ baseUrl: input.value.trim() });
    else if (input.id === 'ai-tools-on') saveChatConfig({ tools: { ...config.tools, enabled: input.checked } });
    else if (input.id === 'ai-tools-write') saveChatConfig({ tools: { ...config.tools, allowWrite: input.checked } });
    else if (input.dataset.tool) {
      const disabled = new Set(config.tools.disabled);
      if (input.checked) disabled.delete(input.dataset.tool); else disabled.add(input.dataset.tool);
      saveChatConfig({ tools: { ...config.tools, disabled: [...disabled] } });
    }
    else if (input.id === 'ai-profile-character') { profileId = input.value; render(); }
    else if (input.id === 'ai-profile-provider') saveProfile({ provider: (input.value || undefined) as ChatProvider | undefined, model: undefined });
    else if (input.id === 'ai-profile-model') saveProfile({ model: input.value.trim() || undefined });
    else if (input.id === 'ai-persona') saveProfile({ persona: input.value.trim() || undefined });
    else if (input.id === 'ai-call') saveProfile({ callUser: input.value.trim() || undefined });
    else if (input.id === 'ai-emoji') saveProfile({ emoji: input.checked });
    else if (input.id === 'ai-extra') saveProfile({ extra: input.value.trim() || undefined });
    else if (input.id === 'ai-base') saveChatConfig({ basePrompt: input.value });
    else if (input.id === 'ai-button') saveChatConfig({ button: input.checked });
  });
  onChat(render);
};

export const showAiSettings = async () => {
  characters = await api.listCharacters().catch(() => []);
  profileId = pack.id;
  render();
};

// One line for the settings tab.
export const aiSummary = () => {
  const { config, providers } = chatState;
  const ok = providers.find((p) => p.id === config.provider)?.available;
  return `${PROVIDER_INFO[config.provider].label}${ok ? '' : ' (연결 필요)'} · 도구 ${config.tools.enabled ? (config.tools.allowWrite ? '전체' : '보기만') : '끔'}`;
};
