import { toUserMessage } from '../../../domain/errors/userMessage';
import type { CharacterChoice } from '../../../shared/characterImport';
import { PROVIDER_INFO, type ChatConfig, type ChatProviderInfo, type ChatToolInfo, type ToolGroup } from '../../../shared/chat';

// The settings tab's wording, apart from the screen (tested in logic.test.ts).

export type NumberKey = 'focusMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakEvery' | 'dailyGoalSessions' | 'petScale';
export type BoolKey = 'autoStartFocus' | 'alwaysOnTop' | 'eyesFollowCursor' | 'walkAround' | 'reduceMotion';

// dailyGoalSessions is drawn with a tomato icon by the screen; the text is the number.
export const stepperText = (key: NumberKey, value: number) =>
  key === 'longBreakEvery' ? `${value}회마다` : key === 'petScale' ? `${value}배` : key === 'dailyGoalSessions' ? String(value) : `${value}분`;

// What to show for an error (the app-wide rule, src/domain/errors).
export const cleanError = (error: unknown) => toUserMessage(error).text;

// An error as one status line.
export const errorLine = (error: unknown) => `✗ ${cleanError(error)}`;

// ---------- 데이터 백업 ----------

export const BACKUP_TEXT = {
  intro: '할 일·메모·집중 기록·플레이리스트·설정을 파일 하나로 옮겨요. 토큰 같은 비밀 값은 빼고 저장해요.',
  exporting: '내보내는 중…',
  picking: '파일을 고르는 중…',
  importCancelled: '가져오기를 취소했어요',
  importing: '가져오는 중…',
  imported: '✓ 가져왔어요. 모든 탭에 반영됐어요',
  overwrite: '지금 데이터가 이 파일 내용으로 바뀌어요. 되돌릴 수 없으니 먼저 내보내 두면 안전해요.'
} as const;

export const backupCounts = (s: { todos: number; notes: number; sessions: number; playlists: number }) =>
  `할 일 ${s.todos} · 메모 ${s.notes} · 집중 기록 ${s.sessions} · 플레이리스트 ${s.playlists}`;

export const exportedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${date.toLocaleDateString('ko-KR')} 백업`;
};

export const exportResult = (result: (Parameters<typeof backupCounts>[0] & { file: string }) | null) =>
  result ? `✓ ${result.file} 에 저장했어요 · ${backupCounts(result)}` : '내보내기를 취소했어요';

// The running pet keeps its progress in memory and writes it back every
// tick, so imported progress goes to the store itself: this reads it out of
// the imported session (null: nothing to apply). A todo that is not in the
// imported list is not kept active.
export const importedSession = (raw: string | null, todoIds: string[]) => {
  if (!raw) return null;
  try {
    const { state } = JSON.parse(raw) as { state?: Record<string, unknown> };
    if (!state) return null;
    const activeTodoId = typeof state.activeTodoId === 'string' && todoIds.includes(state.activeTodoId) ? state.activeTodoId : null;
    return {
      ...(state.progress ? { progress: state.progress } : {}),
      ...(state.planner ? { planner: state.planner } : {}),
      activeTodoId
    };
  } catch {
    return null;
  }
};

// ---------- AI 대화 설정 ----------

export const TOOL_GROUPS: Record<ToolGroup, string> = {
  info: '기본', chat: '대화 세션', todos: '할 일', notes: '메모', timer: '타이머', stats: '통계', settings: '설정', music: '음악', pet: '펫·캐릭터·모드'
};

export const AI_TEXT = {
  keysHint: 'API 키는 이 컴퓨터의 키체인으로 암호화해서 저장하고, 화면으로는 다시 보내지 않아요.',
  searching: '찾는 중…',
  searched: '다시 찾았어요',
  pasteKey: '키를 붙여넣어 주세요',
  keySaved: '키를 저장했어요',
  keyRemoved: '키를 지웠어요'
} as const;

export const providerStatus = (info: { kind: 'cli' | 'api'; needsKey: boolean }, state: ChatProviderInfo | undefined) =>
  info.kind === 'cli'
    ? state?.available ? `✓ ${state.path ?? '설치됨'}` : '✗ 설치 안 됨'
    : state?.hasKey ? '✓ 키 저장됨' : info.needsKey ? '키 필요' : '키 없이 사용 가능';

// Tools by group, in the order groups first appear. `off`: the tool cannot
// run now (tools off, or a write tool without write permission).
export const toolGroups = (tools: ChatToolInfo[], settings: ChatConfig['tools']) => {
  const groups = new Map<ToolGroup, ChatToolInfo[]>();
  for (const tool of tools) groups.set(tool.group, [...(groups.get(tool.group) ?? []), tool]);
  return [...groups].map(([group, list]) => ({
    group,
    title: TOOL_GROUPS[group],
    tools: list.map((t) => ({
      name: t.name, label: t.label, description: t.description, write: t.write,
      checked: !settings.disabled.includes(t.name),
      off: !(settings.enabled && (!t.write || settings.allowWrite))
    }))
  }));
};

export const toggleTool = (disabled: string[], name: string, on: boolean) => {
  const set = new Set(disabled);
  if (on) set.delete(name);
  else set.add(name);
  return [...set];
};

export const testResult = (reply: string, ms: number, model: string) =>
  `✓ 연결됨 (${(ms / 1000).toFixed(1)}초, ${model || '기본 모델'}) · "${reply.slice(0, 40)}"`;

// The characters a profile can be set for; the pet alone until the list loads.
export const profileChoices = (characters: CharacterChoice[], pet: { id: string; name: string }): CharacterChoice[] =>
  characters.length ? characters : [{ id: pet.id, name: pet.name, editable: false, builtin: true }];

export const profileIdFor = (id: string, choices: { id: string }[], fallback: string) =>
  id && choices.some((c) => c.id === id) ? id : fallback;

export const personaPlaceholder = (packPersona: string | undefined) =>
  packPersona ? `캐릭터 기본값: ${packPersona}` : '예: 밝고 장난기 많지만 공부는 꼼꼼히 챙겨 주는 친구';

export const clearAllLabel = (confirming: boolean) => (confirming ? '정말 모두 지울까요?' : '모든 대화 지우기');

// One line for the settings tab.
export const aiSummary = (config: ChatConfig, providers: ChatProviderInfo[]) => {
  const ok = providers.find((p) => p.id === config.provider)?.available;
  return `${PROVIDER_INFO[config.provider].label}${ok ? '' : ' (연결 필요)'} · 도구 ${config.tools.enabled ? (config.tools.allowWrite ? '전체' : '보기만') : '끔'}`;
};
