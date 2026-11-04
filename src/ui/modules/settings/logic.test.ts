import { describe, expect, it } from 'vitest';
import { parseChatConfig, type ChatToolInfo } from '../../../shared/chat';
import {
  aiSummary, backupCounts, cleanError, clearAllLabel, errorLine, exportResult, exportedOn, importedSession, personaPlaceholder,
  profileChoices, profileIdFor, providerStatus, stepperText, testResult, toggleTool, toolGroups
} from './logic';

describe('settings logic', () => {
  it('writes each stepper value in its unit', () => {
    expect(stepperText('focusMinutes', 25)).toBe('25분');
    expect(stepperText('longBreakEvery', 4)).toBe('4회마다');
    expect(stepperText('petScale', 2)).toBe('2배');
  });

  it('strips the IPC wrapper from an error', () => {
    expect(cleanError(new Error("Error invoking remote method 'backup:import': Error: 파일이 비었어요"))).toBe('파일이 비었어요');
    expect(cleanError('그냥 문자열')).toBe('그냥 문자열');
  });

  it('summarizes what a backup holds', () => {
    expect(backupCounts({ todos: 3, notes: 1, sessions: 12, playlists: 0 })).toBe('할 일 3 · 메모 1 · 집중 기록 12 · 플레이리스트 0');
  });

  it('dates a backup, or says nothing for a bad date', () => {
    expect(exportedOn('2026-11-04T09:00:00.000Z')).toMatch(/^2026\. 11\. 4\. 백업$/);
    expect(exportedOn('어제')).toBe('');
  });

  it('says where an export went, or that it was cancelled', () => {
    expect(exportResult({ file: '/tmp/a.json', todos: 1, notes: 2, sessions: 3, playlists: 4 })).toBe('✓ /tmp/a.json 에 저장했어요 · 할 일 1 · 메모 2 · 집중 기록 3 · 플레이리스트 4');
    expect(exportResult(null)).toBe('내보내기를 취소했어요');
  });

  it('marks an error line', () => {
    expect(errorLine(new Error("Error invoking remote method 'data:export': Error: 디스크가 가득 찼어요"))).toBe('✗ 디스크가 가득 찼어요');
  });

  it('reads the pet progress out of an imported session', () => {
    const raw = JSON.stringify({ state: { progress: { xp: 3 }, planner: { day: 1 }, activeTodoId: 't1' } });
    expect(importedSession(raw, ['t1'])).toEqual({ progress: { xp: 3 }, planner: { day: 1 }, activeTodoId: 't1' });
    // a todo that is not there any more is not kept active; missing parts are left out
    expect(importedSession(JSON.stringify({ state: { activeTodoId: 'gone' } }), ['t1'])).toEqual({ activeTodoId: null });
    expect(importedSession(null, [])).toBeNull();
    expect(importedSession('{}', [])).toBeNull();
    expect(importedSession('not json', [])).toBeNull();
  });

  it('tells how each provider is connected', () => {
    const cli = { kind: 'cli', needsKey: false } as const;
    const api = { kind: 'api', needsKey: true } as const;
    expect(providerStatus(cli, { id: 'claude', available: true, path: '/bin/claude' })).toBe('✓ /bin/claude');
    expect(providerStatus(cli, { id: 'claude', available: true })).toBe('✓ 설치됨');
    expect(providerStatus(cli, undefined)).toBe('✗ 설치 안 됨');
    expect(providerStatus(api, { id: 'openai', available: true, hasKey: true })).toBe('✓ 키 저장됨');
    expect(providerStatus(api, { id: 'openai', available: false })).toBe('키 필요');
    expect(providerStatus({ kind: 'api', needsKey: false }, undefined)).toBe('키 없이 사용 가능');
  });

  it('groups tools in order of first appearance and marks what is off', () => {
    const tool = (name: string, group: ChatToolInfo['group'], write: boolean): ChatToolInfo => ({ name, label: name, group, write, description: `${name}!`, allowed: true });
    const tools = [tool('list', 'todos', false), tool('note', 'notes', false), tool('add', 'todos', true)];
    const groups = toolGroups(tools, { enabled: true, allowWrite: false, disabled: ['note'] });
    expect(groups.map((g) => [g.group, g.title, g.tools.map((t) => t.name)])).toEqual([['todos', '할 일', ['list', 'add']], ['notes', '메모', ['note']]]);
    expect(groups[0].tools.map((t) => [t.checked, t.off])).toEqual([[true, false], [true, true]]);
    expect(groups[1].tools[0].checked).toBe(false);
    expect(toolGroups(tools, { enabled: false, allowWrite: true, disabled: [] })[0].tools.every((t) => t.off)).toBe(true);
  });

  it('turns a tool on or off in the disabled list', () => {
    expect(toggleTool(['a', 'b'], 'a', true)).toEqual(['b']);
    expect(toggleTool(['b'], 'a', false)).toEqual(['b', 'a']);
    expect(toggleTool(['a'], 'a', false)).toEqual(['a']);
  });

  it('reports a connection test', () => {
    expect(testResult('연결됐어!', 1234, 'gpt-5')).toBe('✓ 연결됨 (1.2초, gpt-5) · "연결됐어!"');
    expect(testResult('x'.repeat(60), 500, '')).toBe(`✓ 연결됨 (0.5초, 기본 모델) · "${'x'.repeat(40)}"`);
  });

  it('lists characters for profiles, the pet when the list is empty', () => {
    const pet = { id: 'lila', name: '릴라' };
    expect(profileChoices([], pet)).toEqual([{ id: 'lila', name: '릴라', editable: false, builtin: true }]);
    const list = [{ id: 'miso', name: '미소', editable: true, builtin: false }];
    expect(profileChoices(list, pet)).toBe(list);
    expect(profileIdFor('miso', list, 'lila')).toBe('miso');
    expect(profileIdFor('gone', list, 'lila')).toBe('lila');
    expect(profileIdFor('', list, 'lila')).toBe('lila');
  });

  it('suggests a persona', () => {
    expect(personaPlaceholder('상냥해')).toBe('캐릭터 기본값: 상냥해');
    expect(personaPlaceholder(undefined)).toBe('예: 밝고 장난기 많지만 공부는 꼼꼼히 챙겨 주는 친구');
  });

  it('asks once more before clearing every conversation', () => {
    expect(clearAllLabel(false)).toBe('모든 대화 지우기');
    expect(clearAllLabel(true)).toBe('정말 모두 지울까요?');
  });

  it('sums up the AI settings in one line', () => {
    const config = parseChatConfig({ provider: 'claude' });
    expect(aiSummary(config, [{ id: 'claude', available: true }])).toBe('Claude Code · 도구 전체');
    expect(aiSummary({ ...config, tools: { ...config.tools, allowWrite: false } }, [])).toBe('Claude Code (연결 필요) · 도구 보기만');
    expect(aiSummary({ ...config, tools: { ...config.tools, enabled: false } }, [{ id: 'claude', available: true }])).toBe('Claude Code · 도구 끔');
  });
});
