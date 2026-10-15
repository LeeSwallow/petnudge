import { ChatAnthropic } from '@langchain/anthropic';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type AIMessageChunk, type BaseMessage } from '@langchain/core/messages';
import { tool, type StructuredToolInterface } from '@langchain/core/tools';
import { ChatOpenAI } from '@langchain/openai';
import { modelFor, type ChatConfig, type ChatEvent, type ChatMessage, type ChatProvider } from '../shared/chat';
import { runPetTool, type PetTool } from './petTools';

// API providers: a LangChain chat model with the app tools bound, in a small
// agent loop (model → tool calls → tool results → model…) that streams text.

const MAX_STEPS = 8;

export const createModel = (provider: ChatProvider, config: ChatConfig, apiKey: string | null, model = modelFor(config, provider)): BaseChatModel => {
  if (provider === 'anthropic') {
    if (!apiKey) throw new Error('Anthropic API 키를 넣어 주세요');
    return new ChatAnthropic({ model, apiKey, maxTokens: 2048 });
  }
  if (provider === 'openai') {
    if (!apiKey) throw new Error('OpenAI API 키를 넣어 주세요');
    return new ChatOpenAI({ model, apiKey });
  }
  if (provider === 'openrouter') {
    if (!apiKey) throw new Error('OpenRouter API 키를 넣어 주세요');
    return new ChatOpenAI({
      model, apiKey,
      configuration: { baseURL: 'https://openrouter.ai/api/v1', defaultHeaders: { 'X-Title': 'Study Companion Pet' } }
    });
  }
  if (provider === 'custom') {
    if (!/^https?:\/\//.test(config.baseUrl)) throw new Error('호환 서버 주소를 http(s)://… 로 적어 주세요');
    return new ChatOpenAI({ model, apiKey: apiKey || 'not-needed', configuration: { baseURL: config.baseUrl } });
  }
  throw new Error(`${provider}는 API 제공자가 아니에요`);
};

type RunOptions = {
  model: BaseChatModel;
  system: string;
  messages: ChatMessage[];
  tools: PetTool[];
  signal: AbortSignal;
  onEvent: (event: ChatEvent) => void;
};

const brief = (input: unknown) => {
  const text = JSON.stringify(input ?? {});
  return text === '{}' ? undefined : text.length > 80 ? `${text.slice(0, 78)}…` : text;
};

export const runAgent = async ({ model, system, messages, tools, signal, onEvent }: RunOptions): Promise<string> => {
  const byName = new Map(tools.map((t) => [t.name, t]));
  const lcTools: StructuredToolInterface[] = tools.map((t) =>
    tool(async (input: unknown) => {
      onEvent({ type: 'tool', name: t.name, label: t.label, detail: brief(input) });
      const result = await runPetTool(t, input);
      onEvent({ type: 'tool', name: t.name, label: t.label, ok: result.ok, detail: brief(input) });
      return result.text;
    }, { name: t.name, description: t.description, schema: t.schema as never }));
  const lcByName = new Map(lcTools.map((t) => [t.name, t]));
  const bound = lcTools.length && model.bindTools ? model.bindTools(lcTools) : model;

  const history: BaseMessage[] = [
    new SystemMessage(system),
    ...messages.map((m) => (m.role === 'user' ? new HumanMessage(m.text) : new AIMessage(m.text)))
  ];
  let shown = '';
  for (let step = 0; step < MAX_STEPS; step++) {
    let full: AIMessageChunk | undefined;
    const prefix = shown ? '\n' : '';
    let turnText = '';
    for await (const chunk of await bound.stream(history, { signal })) {
      full = full ? full.concat(chunk) : chunk;
      const piece = chunk.text;
      if (piece) {
        turnText += piece;
        onEvent({ type: 'delta', text: shown + prefix + turnText });
      }
    }
    if (turnText) shown += prefix + turnText;
    if (!full) break;
    const calls = full.tool_calls ?? [];
    history.push(full);
    if (calls.length === 0) break;
    for (const call of calls) {
      const lc = lcByName.get(call.name);
      if (!lc || !byName.has(call.name)) {
        history.push(new ToolMessage({ tool_call_id: call.id ?? '', content: `Unknown tool ${call.name}.` }));
        continue;
      }
      try {
        history.push(await lc.invoke({ ...call, type: 'tool_call' }));
      } catch (error) {
        // Bad arguments go back to the model instead of ending the reply.
        const reason = error instanceof Error ? error.message : String(error);
        onEvent({ type: 'tool', name: call.name, label: byName.get(call.name)!.label, ok: false, detail: reason.slice(0, 80) });
        history.push(new ToolMessage({ tool_call_id: call.id ?? '', content: `Error: ${reason}` }));
      }
    }
  }
  return shown.trim();
};
