import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt, parseChatConfig } from '../shared/chat';
import { allowedTools } from './chat';
import { createRepository, type Repository } from './db/repository';
import { migrate } from './db/schema';
import { createPetTools, runPetTool, type PetTool, type ToolBridge } from './petTools';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

let repo: Repository;
let bridge: ToolBridge;
let tools: PetTool[];
const run = (name: string, input: unknown = {}) => runPetTool(tools.find((t) => t.name === name)!, input);

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  repo = createRepository(db);
  bridge = { sendTimerCommand: vi.fn(), notifyChanged: vi.fn(), todayKey: () => '2026-10-15', petCommand: vi.fn() };
  tools = createPetTools(repo, bridge);
});

describe('pet tools', () => {
  it('edits and deletes todos', async () => {
    const { text } = await run('add_todo', { title: '영단어', estimate: 1 });
    const { id } = JSON.parse(text);
    await run('update_todo', { id, title: '영단어 50개', estimate: 2 });
    expect(repo.listTodos()[0]).toMatchObject({ title: '영단어 50개', estimate: 2 });
    expect((await run('delete_todo', { id })).ok).toBe(true);
    expect(repo.listTodos()).toEqual([]);
    expect((await run('delete_todo', { id })).ok).toBe(false);
  });

  it('appends to and pins notes', async () => {
    const { id } = JSON.parse((await run('add_note', { title: '오늘', body: '1. 미분' })).text);
    await run('update_note', { id, append: '2. 적분', pinned: true });
    expect(repo.listNotes('')[0]).toMatchObject({ body: '1. 미분\n2. 적분', pinned: true });
    expect(bridge.notifyChanged).toHaveBeenCalledWith('notes');
  });

  it('rejects invalid input and sends pet commands', async () => {
    expect((await run('update_settings', { focusMinutes: 999 })).ok).toBe(false);
    await run('update_settings', { focusMinutes: 50 });
    expect(repo.getSettings().focusMinutes).toBe(50);
    await run('pet_express', { fx: 'hearts' });
    expect(bridge.petCommand).toHaveBeenCalledWith({ type: 'express', fx: 'hearts' });
  });

  it('filters tools by the chat settings', () => {
    const names = (config: unknown) => allowedTools(tools, parseChatConfig(config)).map((t) => t.name);
    expect(names({})).toContain('delete_note');
    expect(names({ tools: { enabled: true, allowWrite: false, disabled: [] } })).not.toContain('add_todo');
    expect(names({ tools: { enabled: true, allowWrite: true, disabled: ['list_notes'] } })).not.toContain('list_notes');
    expect(names({ tools: { enabled: false, allowWrite: true, disabled: [] } })).toEqual([]);
  });

  it('builds the prompt from the base and the character profile', () => {
    const config = parseChatConfig({ basePrompt: 'BASE', profiles: { moa: { speech: 'jondaet', length: 'long', callUser: '선배', emoji: false, extra: '게임 비유' } } });
    const prompt = buildSystemPrompt(config, { characterId: 'moa', character: '모아', packPersona: '게이머', status: '집중 중' });
    expect(prompt).toContain('BASE');
    expect(prompt).toContain('성격·말투: 게이머');
    expect(prompt).toContain('존댓말로, 자세하게');
    expect(prompt).toContain('"선배"');
    expect(prompt).toContain('이모지는 쓰지 마');
    expect(prompt).toContain('추가 지시: 게임 비유');
  });
});
