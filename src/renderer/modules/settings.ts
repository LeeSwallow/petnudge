import { pixelIcon } from '../icons';
import { api } from '../api';
import { unlockables } from '../../domain/progress/progress';
import { esc } from '../charts';
import { pack, setCharacter } from '../character';
import { modStatus, onModStatus } from '../pet/mods';
import { onChat } from '../chat';
import { aiSummary, mountAiSettings, showAiSettings } from './aiSettings';
import { petStore } from '../store';
import { data, updateSettings } from '../data';
import { avatarFor, type AppSettings } from '../../shared/settings';
import type { CharacterChoice } from '../../shared/characterImport';
import { $, onAction, type PanelModule } from './module';
import { backupSection, mountBackup } from './backup';

let root: HTMLElement;
let characters: CharacterChoice[] = [];
let characterBusy = false;

const characterTask = async (task: () => Promise<void>) => {
  if (characterBusy) return;
  characterBusy = true;
  const status = $(root, '#character-status');
  status.textContent = '불러오는 중…';
  root.querySelectorAll<HTMLButtonElement | HTMLSelectElement>('[data-character]').forEach((el) => { el.disabled = true; });
  try {
    await task();
    status.textContent = '적용했어요';
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '캐릭터를 적용하지 못했어요';
  } finally {
    characterBusy = false;
    await renderCharacters();
    renderDressUp();
  }
};

const renderCharacters = async () => {
  try {
    characters = await api.listCharacters();
    const select = $<HTMLSelectElement>(root, '#character-select');
    select.innerHTML = characters.map((c) => `<option value="${c.id}">${esc(c.name)}${c.builtin ? ' (기본)' : ''}</option>`).join('');
    select.value = pack.id;
    select.disabled = characterBusy;
    const editable = characters.find((c) => c.id === pack.id)?.editable ?? false;
    root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach((button) => {
      button.disabled = characterBusy || button.dataset.character === 'edit' && !editable;
    });
  } catch (error) {
    $(root, '#character-status').textContent = error instanceof Error ? error.message : '캐릭터 목록을 읽지 못했어요';
  }
};

type NumberKey = 'focusMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakEvery' | 'dailyGoalSessions' | 'petScale';
type BoolKey = 'autoStartFocus' | 'alwaysOnTop' | 'eyesFollowCursor' | 'walkAround' | 'reduceMotion';

const steppers: [NumberKey, string, number, (v: number) => string][] = [
  ['focusMinutes', '집중 시간', 5, (v) => `${v}분`],
  ['breakMinutes', '짧은 휴식', 1, (v) => `${v}분`],
  ['longBreakMinutes', '긴 휴식', 5, (v) => `${v}분`],
  ['longBreakEvery', '긴 휴식 주기', 1, (v) => `${v}회마다`],
  ['dailyGoalSessions', '하루 목표', 1, (v) => `${pixelIcon('tomato')} ${v}`]
];

const toggles: [BoolKey, string][] = [
  ['autoStartFocus', '휴식이 끝나면 바로 다음 집중 시작'],
  ['alwaysOnTop', '항상 다른 창 위에 표시'],
  ['eyesFollowCursor', '눈으로 마우스 커서 따라보기'],
  ['walkAround', '가끔 화면 위를 걸어다니기 (집중 중에는 쉬어요)'],
  ['reduceMotion', '움직임 줄이기 (전환 효과 끄기)']
];

const stepper = (key: NumberKey, label: string, step: number) =>
  `<div class="stepper"><span class="grow">${label}</span>
     <button type="button" data-action="step" data-key="${key}" data-step="${-step}">-</button>
     <output id="out-${key}"></output>
     <button type="button" data-action="step" data-key="${key}" data-step="${step}">+</button></div>`;

let mcpRendered = false;

const copyRow = (label: string, value: string) =>
  `<div class="copy-row"><div class="hint">${label}</div><div class="row"><code class="grow">${esc(value)}</code><button type="button" data-action="copy" data-copy="${esc(value)}">복사</button></div></div>`;


const renderDressUp = () => {
  const unlocked = petStore.getState().progress.unlockedIds;
  const completed = petStore.getState().progress.completedSessions;
  $(root, '#dressup').innerHTML = Object.entries(pack.slots)
    .map(([slot, def]) => {
      const chosen = avatarFor(pack, data.settings)[slot] ?? Object.keys(def.variants)[0];
      const buttons = Object.entries(def.variants)
        .map(([id, variant]) => {
          const locked = variant.unlock && !unlocked.includes(variant.unlock);
          const need = unlockables.find((u) => u.id === variant.unlock);
          const swatch = def.swatch ? variant.recolor?.map[def.swatch] ?? def.swatch : null;
          const tip = locked && need ? `잠김 · ${need.requiredSessions}세션 완료 시 해금 (지금 ${completed})` : variant.label;
          return `<button type="button" class="swatch ${id === chosen ? 'selected' : ''}" data-action="avatar" data-slot="${slot}" data-id="${id}" ${
            locked ? 'disabled' : ''
          } data-tip="${esc(tip)}">${swatch ? `<i style="background:${swatch}"></i>` : ''}${esc(variant.label)}${locked ? ' ' + pixelIcon('lock') : ''}</button>`;
        })
        .join('');
      return `<div class="slot-row"><span class="slot-label">${esc(def.label)}</span><div class="swatches">${buttons}</div></div>`;
    })
    .join('');
};

const renderMcp = async () => {
  if (mcpRendered) return;
  const info = await api.getMcpInfo();
  const box = $(root, '#mcp-box');
  if (!info) {
    box.innerHTML = `<div class="hint">MCP 서버를 시작하지 못했어요.</div>`;
    return;
  }
  mcpRendered = true;
  const claudeCode = `claude mcp add --transport http petnudge ${info.url} --header "Authorization: Bearer ${info.token}" --scope user`;
  const cursor = JSON.stringify({ mcpServers: { petnudge: { url: info.url, headers: { Authorization: `Bearer ${info.token}` } } } });
  box.innerHTML = `
    <div class="hint">Claude·Cursor 같은 AI가 할 일·메모·통계를 읽고, 타이머를 켤 수 있어요. 앱이 켜져 있을 때만 동작해요.</div>
    ${copyRow('Claude Code (터미널에 붙여넣기)', claudeCode)}
    ${copyRow('Cursor (~/.cursor/mcp.json)', cursor)}
    <div class="hint">토큰은 이 컴퓨터에만 저장돼요. 다른 사람에게 공유하지 마세요.</div>`;
};

const renderChatSettings = () => {
  $(root, '#ai-summary').textContent = aiSummary();
};

// The AI chat settings are a page of their own over the settings list.
const showAiPage = (show: boolean) => {
  root.classList.toggle('ai-open', show);
  $(root, '#ai-page').hidden = !show;
  if (show) void showAiSettings();
  root.scrollTop = 0;
  root.closest('.module-host')?.scrollTo({ top: 0 });
};

// Mods: a row per mod with an on/off switch and a button that opens its file.
const renderMods = () => {
  const { mods, problems } = modStatus();
  $(root, '#mod-list').innerHTML = mods.length ? mods.map(({ mod, builtin, enabled, path }) => `
    <div class="row mod-row">
      <label class="toggle grow" data-tip="${esc(mod.description ?? '')}">${esc(mod.name)} <small>${builtin ? '기본' : '내 모드'} · 행동 ${mod.behaviors.length}개</small>
        <input type="checkbox" data-mod="${esc(mod.id)}" ${enabled ? 'checked' : ''} /></label>
      <button type="button" class="ghost" data-action="mod-open" data-path="${esc(path)}">열기</button>
    </div>`).join('') : '<div class="hint">모드가 없어요.</div>';
  $(root, '#mod-problems').textContent = problems.map((p) => `⚠ ${p.path.split('/').slice(-2).join('/')}: ${p.error}`).join('\n');
};

export const settingsModule: PanelModule = {
  id: 'settings',
  label: '설정',
  icon: 'gear',
  watches: ['settings', 'session'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="section-title">뽀모도로</div>
      <div class="frame well setting-group">${steppers.map(([k, l, s]) => stepper(k, l, s)).join('')}
        <label class="toggle">${toggles[0][1]}<input type="checkbox" data-bool="${toggles[0][0]}" /></label>
      </div>
      <div class="section-title">캐릭터 꾸미기 <small>${esc(pack.name)}</small></div>
      <div class="frame well setting-group">
        <label class="row">캐릭터 <select class="grow" id="character-select" data-character="select" aria-label="캐릭터 선택"></select></label>
        <div class="row">
          <button type="button" data-action="character-import" data-character="import">팩 가져오기</button>
          <button type="button" data-action="character-edit" data-character="edit">원본 편집</button>
        </div>
        <button type="button" data-action="character-reload" data-character="edit">저장한 원본 다시 적용</button>
        <div class="row"><input type="text" id="clone-name" class="grow" maxlength="40" placeholder="새 캐릭터 이름" aria-label="새 캐릭터 이름" />
          <button type="button" data-action="character-clone" data-character="clone">이 캐릭터로 새로 만들기</button></div>
        <div class="hint">원본 편집을 누르면 저장할 때마다 자동으로 반영돼요. 새로 만들면 지금 캐릭터의 그림·표정·동작이 복사돼요.</div>
        <div class="hint" id="character-status" role="status" aria-live="polite"></div>
      </div>
      <div class="frame well setting-group" id="dressup"></div>
      <div class="section-title">펫</div>
      <div class="frame well setting-group">
        ${stepper('petScale', '크기', 1)}
        ${toggles
          .slice(1)
          .map(([k, l]) => `<label class="toggle">${l}<input type="checkbox" data-bool="${k}" /></label>`)
          .join('')}
      </div>
      <div class="section-title">모드 <small>행동 스크립트</small></div>
      <div class="frame well setting-group">
        <div id="mod-list"></div>
        <div class="row"><button type="button" data-action="mod-create" class="grow">새 모드 만들기</button></div>
        <div class="hint">모드는 블록(JSON)으로 "언제 → 무엇을"을 적어요. 저장하면 바로 다시 불러와요.</div>
        <div class="hint" id="mod-problems" role="status" aria-live="polite"></div>
      </div>
      ${backupSection}
      <div class="section-title">프로필</div>
      <div class="frame well setting-group">
        <div class="row"><span style="width:52px">닉네임</span><input type="text" id="nickname" class="grow" maxlength="16" placeholder="방·랭킹에 표시될 이름" /></div>
      </div>
      <div class="section-title">AI 대화 <small>펫과 말하기</small></div>
      <div class="frame well setting-group">
        <button type="button" class="ai-open-button" data-action="ai-open">
          <span class="grow"><b>AI 대화 설정 열기</b><small id="ai-summary"></small></span><span aria-hidden="true">›</span>
        </button>
        <div class="hint">연결할 AI(Claude Code·Codex·Anthropic·OpenAI·OpenRouter·로컬), 도구 권한, 캐릭터별 말투와 프롬프트를 정해요.</div>
      </div>
      <div class="section-title">AI 연결 (MCP)</div>
      <div class="frame well setting-group" id="mcp-box"><div class="hint">불러오는 중…</div></div>
      <div class="row">
        <button type="button" data-action="reset-position" class="grow">${pixelIcon('home')} 펫 위치 초기화</button>
        <button class="ghost" type="button" data-action="quit">펫 종료</button>
      </div>
      <div class="hint">펫을 잃어버렸다면 ⌘/Ctrl + Alt + P 로 오른쪽 아래로 불러올 수 있어요.</div>`;

    root.addEventListener('change', (event) => {
      const input = event.target as HTMLInputElement;
      if (input.dataset.bool) void updateSettings({ [input.dataset.bool]: input.checked } as Partial<AppSettings>);
      if (input.dataset.mod) void api.setModEnabled(input.dataset.mod, input.checked);
    });
    onModStatus(() => renderMods());
    mountBackup(root);
    onChat(() => { if (!root.hidden) renderChatSettings(); });
    const aiPage = document.createElement('div');
    aiPage.id = 'ai-page';
    aiPage.hidden = true;
    root.append(aiPage);
    mountAiSettings(aiPage, () => showAiPage(false));
    api.onCharacterError((id, message) => {
      if (id === pack.id) $(root, '#character-status').textContent = `✗ 다시 반영하지 못했어요: ${message}`;
    });
    const nickname = $<HTMLInputElement>(root, '#nickname');
    $<HTMLSelectElement>(root, '#character-select').addEventListener('change', (event) => {
      const id = (event.target as HTMLSelectElement).value;
      void characterTask(async () => {
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
      });
    });
    nickname.addEventListener('change', () => void updateSettings({ nickname: nickname.value }));

    onAction(root, {
      step: (target) => {
        const key = target.dataset.key as NumberKey;
        void updateSettings({ [key]: data.settings[key] + Number(target.dataset.step) } as Partial<AppSettings>);
      },
      avatar: (target) => {
        const slot = target.dataset.slot!, id = target.dataset.id!;
        if (!pack.slots[slot]?.variants[id]) return;
        void updateSettings({ characterAvatars: { ...data.settings.characterAvatars, [pack.id]: { ...avatarFor(pack, data.settings), [slot]: id } } });
      },
      'character-import': () => void characterTask(async () => {
        const id = await api.importCharacter();
        if (!id) return;
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
      }),
      'character-edit': () => void characterTask(async () => { await api.editCharacter(pack.id); }),
      'character-clone': () => void characterTask(async () => {
        const input = $<HTMLInputElement>(root, '#clone-name');
        const id = await api.cloneCharacter(pack.id, input.value.trim() || `${pack.name} 2`);
        input.value = '';
        await setCharacter(await api.getCharacter(id));
        await updateSettings({ characterId: id });
        await api.editCharacter(id);
      }),
      'ai-open': () => showAiPage(true),
      'mod-create': () => void api.createMod(),
      'mod-open': (target) => void api.openMod(target.dataset.path ?? ''),
      'character-reload': () => void characterTask(async () => {
        await setCharacter(await api.rebuildCharacter(pack.id));
        await updateSettings({ characterId: pack.id });
      }),
      quit: () => api.quit(),
      'reset-position': () => api.resetPosition(),
      copy: (target) => {
        void navigator.clipboard.writeText(target.dataset.copy ?? '');
        target.textContent = '복사됨!';
        setTimeout(() => (target.textContent = '복사'), 1500);
      }
    });
  },

  render() {
    void renderCharacters();
    renderMods();
    renderChatSettings();
    void renderMcp();
    renderDressUp();
    for (const [key, , , format] of steppers) $(root, `#out-${key}`).innerHTML = format(data.settings[key]);
    $(root, '#out-petScale').textContent = `${data.settings.petScale}배`;
    root.querySelectorAll<HTMLInputElement>('[data-bool]').forEach((input) => {
      input.checked = data.settings[input.dataset.bool as BoolKey];
    });
    const nickname = $<HTMLInputElement>(root, '#nickname');
    if (document.activeElement !== nickname) nickname.value = data.settings.nickname;
  }
};
