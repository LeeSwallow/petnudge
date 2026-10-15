import { AIMessageChunk } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { describe, expect, it, vi } from 'vitest';
import { parseChatConfig, type ChatEvent } from '../shared/chat';
import { createModel, runAgent } from './chatAgent';
import { createRepository } from './db/repository';
import { migrate } from './db/schema';
import { createPetTools } from './petTools';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

// A scripted model: each turn streams the next list of chunks.
const scripted = (turns: AIMessageChunk[][]) => {
  let turn = 0;
  const seen: unknown[][] = [];
  const model = {
    bindTools: () => model,
    stream: async (messages: unknown[]) => {
      seen.push(messages);
      const chunks = turns[turn++] ?? [new AIMessageChunk('')];
      return (async function* () { yield* chunks; })();
    }
  };
  return { model: model as unknown as BaseChatModel, seen };
};

describe('chat agent', () => {
  it('streams text, runs tool calls and feeds the results back', async () => {
    const db = new DatabaseSync(':memory:');
    migrate(db);
    const repo = createRepository(db);
    const tools = createPetTools(repo, { sendTimerCommand: vi.fn(), notifyChanged: vi.fn(), todayKey: () => '2026-10-15' });
    const { model, seen } = scripted([
      [new AIMessageChunk({ content: '추가할게.', tool_calls: [{ id: 'c1', name: 'add_todo', args: { title: '물리 2장' } }] })],
      [new AIMessageChunk('추가'), new AIMessageChunk('했어!')]
    ]);
    const events: ChatEvent[] = [];
    const answer = await runAgent({ model, system: 'S', messages: [{ role: 'user', text: '물리 2장 추가해 줘' }], tools, signal: new AbortController().signal, onEvent: (e) => events.push(e) });

    expect(answer).toBe('추가할게.\n추가했어!');
    expect(repo.listTodos().map((t) => t.title)).toEqual(['물리 2장']);
    expect(events.filter((e) => e.type === 'tool')).toMatchObject([{ label: '할 일 추가' }, { label: '할 일 추가', ok: true }]);
    expect(events.at(-1)).toEqual({ type: 'delta', text: '추가할게.\n추가했어!' });
    // The second turn saw the tool result.
    expect(JSON.stringify(seen[1])).toContain('물리 2장');
  });

  it('asks for a key before calling API providers', () => {
    const config = parseChatConfig({});
    expect(() => createModel('anthropic', config, null)).toThrow('Anthropic API 키');
    expect(() => createModel('openrouter', config, null)).toThrow('OpenRouter API 키');
    expect(() => createModel('custom', { ...config, baseUrl: 'localhost' }, null)).toThrow('http');
    expect(createModel('openrouter', config, 'sk-or-test')).toBeTruthy();
  });
});
