import { toUserMessage } from '../../../domain/errors/userMessage';
import { t, formatDate, type MessageKey } from '../../i18n';
import type { CharacterChoice } from '../../../shared/characterImport';
import { PROVIDER_INFO, type ChatConfig, type ChatProvider, type ChatProviderInfo, type ChatToolInfo, type ToolGroup } from '../../../shared/chat';

// The settings tab's wording, apart from the screen (tested in logic.test.ts).

export type NumberKey = 'focusMinutes' | 'breakMinutes' | 'longBreakMinutes' | 'longBreakEvery' | 'dailyGoalSessions' | 'petScale';
export type BoolKey = 'autoStartFocus' | 'alwaysOnTop' | 'eyesFollowCursor' | 'walkAround' | 'reduceMotion' | 'chatShortcut';

// dailyGoalSessions is drawn with a tomato icon by the screen; the text is the number.
export const stepperText = (key: NumberKey, value: number) =>
  key === 'longBreakEvery' ? t('settings.everyN', { count: value })
    : key === 'petScale' ? t('settings.timesScale', { count: value })
    : key === 'dailyGoalSessions' ? String(value)
    : t('settings.minutes', { count: value });

// What to show for an error (the app-wide rule, src/domain/errors).
export const cleanError = (error: unknown) => toUserMessage(error).text;

// An error as one status line.
export const errorLine = (error: unknown) => `✗ ${cleanError(error)}`;

// ---------- 데이터 백업 ----------

export const backupText = (key: 'intro' | 'exporting' | 'picking' | 'importCancelled' | 'importing' | 'imported' | 'overwrite') =>
  t(`backup.${key}` as const);

export const backupCounts = (s: { todos: number; notes: number; sessions: number; playlists: number }) =>
  t('backup.counts', s);

export const exportedOn = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : t('backup.exportedOn', { date: formatDate(date, { year: 'numeric', month: 'numeric', day: 'numeric' }) });
};

export const exportResult = (result: (Parameters<typeof backupCounts>[0] & { file: string }) | null) =>
  result ? t('backup.exported', { file: result.file, counts: backupCounts(result) }) : t('backup.exportCancelled');

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

export const toolGroupTitle = (group: ToolGroup) => t(`ai.toolGroup.${group}` as MessageKey);

export const aiText = (key: 'keysHint' | 'searching' | 'searched' | 'pasteKey' | 'keySaved' | 'keyRemoved') => t(`ai.${key}` as const);

export const providerStatus = (info: { kind: 'cli' | 'api'; needsKey: boolean }, state: ChatProviderInfo | undefined) =>
  info.kind === 'cli'
    ? state?.available ? `✓ ${state.path ?? t('ai.status.installed')}` : t('ai.status.notInstalled')
    : state?.hasKey ? t('ai.status.keySaved') : info.needsKey ? t('ai.status.needsKey') : t('ai.status.noKeyNeeded');

// Tools by group, in the order groups first appear. `off`: the tool cannot
// run now (tools off, or a write tool without write permission).
export const toolGroups = (tools: ChatToolInfo[], settings: ChatConfig['tools']) => {
  const groups = new Map<ToolGroup, ChatToolInfo[]>();
  for (const tool of tools) groups.set(tool.group, [...(groups.get(tool.group) ?? []), tool]);
  return [...groups].map(([group, list]) => ({
    group,
    title: toolGroupTitle(group),
    tools: list.map((tool) => ({
      name: tool.name, label: tool.label, description: tool.description, write: tool.write,
      checked: !settings.disabled.includes(tool.name),
      off: !(settings.enabled && (!tool.write || settings.allowWrite))
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
  t('ai.testOk', { seconds: (ms / 1000).toFixed(1), model: model || t('ai.defaultModel'), reply: reply.slice(0, 40) });

// The characters a profile can be set for; the pet alone until the list loads.
export const profileChoices = (characters: CharacterChoice[], pet: { id: string; name: string }): CharacterChoice[] =>
  characters.length ? characters : [{ id: pet.id, name: pet.name, editable: false, builtin: true }];

export const profileIdFor = (id: string, choices: { id: string }[], fallback: string) =>
  id && choices.some((c) => c.id === id) ? id : fallback;

export const personaPlaceholder = (packPersona: string | undefined) =>
  packPersona ? t('ai.personaDefault', { persona: packPersona }) : t('ai.personaExample');

export const clearAllLabel = (confirming: boolean) => (confirming ? t('ai.clearAllConfirm') : t('ai.clearAll'));

// A provider's name and hint in the current language.
export const providerLabel = (id: ChatProvider) => (id === 'custom' ? t('ai.provider.custom') : PROVIDER_INFO[id].label);
export const providerHint = (id: ChatProvider) => t(`ai.provider.${id}.hint` as const);

// One line for the settings tab.
export const aiSummary = (config: ChatConfig, providers: ChatProviderInfo[]) => {
  const ok = providers.find((p) => p.id === config.provider)?.available;
  const tools = config.tools.enabled ? (config.tools.allowWrite ? t('ai.summary.toolsAll') : t('ai.summary.toolsRead')) : t('ai.summary.toolsOff');
  return t('ai.summary', { provider: providerLabel(config.provider), needsLink: ok ? '' : t('ai.summary.needsLink'), tools });
};
