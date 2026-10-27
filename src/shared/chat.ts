import * as z from 'zod/v4';

// Chatting with the pet. Two kinds of providers:
//   cli  the user's own Claude Code / Codex (no key in the app; app tools
//        reach them through the local MCP server)
//   api  LangChain chat models with the app tools bound (main/chatAgent.ts);
//        keys are stored encrypted in the main process, never in the renderer.

export const CHAT_PROVIDERS = ['claude', 'codex', 'anthropic', 'openai', 'openrouter', 'custom'] as const;
export type ChatProvider = (typeof CHAT_PROVIDERS)[number];

export const PROVIDER_INFO: Record<ChatProvider, { label: string; kind: 'cli' | 'api'; needsKey: boolean; model: string; hint: string }> = {
  claude: { label: 'Claude Code', kind: 'cli', needsKey: false, model: '', hint: '설치된 claude CLI · 로그인한 구독으로 대답해요' },
  codex: { label: 'Codex', kind: 'cli', needsKey: false, model: '', hint: '설치된 codex CLI · 로그인한 계정으로 대답해요' },
  anthropic: { label: 'Anthropic API', kind: 'api', needsKey: true, model: 'claude-sonnet-5-5', hint: 'console.anthropic.com 에서 만든 API 키' },
  openai: { label: 'OpenAI API', kind: 'api', needsKey: true, model: 'gpt-5-mini', hint: 'platform.openai.com 에서 만든 API 키' },
  openrouter: { label: 'OpenRouter', kind: 'api', needsKey: true, model: 'openrouter/auto', hint: 'openrouter.ai 키 · 모델 이름은 openrouter.ai/models 참고' },
  custom: { label: '로컬·호환 서버', kind: 'api', needsKey: false, model: 'llama3.1', hint: 'Ollama·LM Studio 같은 OpenAI 호환 주소 (키는 선택)' }
};

export type ChatProviderInfo = { id: ChatProvider; available: boolean; path?: string; hasKey?: boolean };

export const DEFAULT_BASE_PROMPT = [
  '너는 사용자의 데스크톱 위에 같이 사는 친구 캐릭터야. 비서나 도우미가 아니라, 옆자리에서 수다 떠는 사람처럼 대화해.',
  '대부분은 잡담이야. 사용자의 말에 감정으로 먼저 반응하고, 네 생각·취향·오늘 있었던 일도 꺼내고, 궁금한 건 되물어 봐.',
  '사용자가 먼저 꺼내지 않으면 공부·할 일·타이머·시간 얘기로 대화를 끌고 가지 마. 공부하라고 재촉하지도 마.',
  '공부 질문을 받으면 그때는 핵심만 정확하게, 네 말투 그대로 설명해. 마크다운 표나 긴 코드 블록은 피해.',
  '할 일·메모·타이머·설정·음악은 도구로 다룰 수 있지만, 사용자가 부탁할 때만 써. 쓴 뒤엔 한 일을 짧게, 캐릭터답게 말해.',
  '삭제처럼 되돌리기 어려운 일은 사용자가 분명히 원할 때만 해.',
  '파일을 읽거나 컴퓨터 명령을 실행할 수는 없어.'
].join('\n');

const text = (max: number) => z.string().max(max);

export const profileSchema = z.object({
  persona: text(800).optional(), // empty → the pack's persona
  speech: z.enum(['banmal', 'jondaet']).optional(), // empty → as the persona says
  length: z.enum(['short', 'normal', 'long']).default('short'),
  callUser: text(40).optional(), // empty → the nickname
  emoji: z.boolean().default(true),
  extra: text(2000).optional(),
  // Who answers as this character (empty → the default provider), so
  // characters on different LLMs can talk to each other.
  provider: z.enum(CHAT_PROVIDERS).optional(),
  model: text(120).optional()
});
export type ChatProfile = z.infer<typeof profileSchema>;

export const chatConfigSchema = z.object({
  provider: z.enum(CHAT_PROVIDERS).default('claude'),
  models: z.partialRecord(z.enum(CHAT_PROVIDERS), text(120)).default({}),
  baseUrl: text(300).default('http://localhost:11434/v1'),
  tools: z.object({
    enabled: z.boolean().default(true),
    allowWrite: z.boolean().default(true),
    disabled: z.array(text(60)).max(100).default([])
  }).default({ enabled: true, allowWrite: true, disabled: [] }),
  button: z.boolean().default(true),
  basePrompt: text(4000).default(DEFAULT_BASE_PROMPT),
  profiles: z.record(text(48), profileSchema).default({})
});
export type ChatConfig = z.infer<typeof chatConfigSchema>;

export const parseChatConfig = (input: unknown): ChatConfig => {
  const parsed = chatConfigSchema.safeParse(input ?? {});
  return parsed.success ? parsed.data : chatConfigSchema.parse({});
};

export const modelFor = (config: ChatConfig, provider: ChatProvider = config.provider) =>
  config.models[provider]?.trim() || PROVIDER_INFO[provider].model;

// Which provider and model answer as a character: its profile, else the default.
export const routeFor = (config: ChatConfig, characterId: string, override?: ChatProvider) => {
  const profile = config.profiles[characterId];
  const provider = override ?? profile?.provider ?? config.provider;
  const model = (!override && profile?.provider && profile.model?.trim()) || modelFor(config, provider);
  return { provider, model };
};

// Tool calls show in the conversation as 'tool' lines (never sent to models).
// In group sessions `speaker` is the character id of a 'pet' line, or
// `guest:<name>` for an outside AI that joined over MCP.
export type ChatMessage = { role: 'user' | 'pet' | 'tool'; text: string; speaker?: string; at?: number };

export type ToolGroup = 'todos' | 'notes' | 'timer' | 'stats' | 'settings' | 'music' | 'pet' | 'info' | 'chat';
export type ChatToolInfo = { name: string; label: string; group: ToolGroup; write: boolean; description: string; allowed: boolean };

// Things only the running pet (renderer) can do, asked for by a tool.
export type PetCommand =
  | { type: 'express'; fx?: string; face?: string; action?: string; ms?: number }
  | { type: 'music'; action: 'play' | 'pause' | 'next' }
  | { type: 'character'; id: string }
  | { type: 'chat-post'; sessionId: string; name: string; text: string; reply: boolean };

// What the renderer sends with each message (validated in main).
export type ChatRequest = {
  messages: ChatMessage[];
  characterId: string;
  character: string;
  packPersona?: string;
  nickname?: string;
  status: string;
  // Everyone in a group session (names), when there is more than her.
  members?: string[];
};

// Progress of one reply, sent from main while it is written.
export type ChatEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool'; name: string; label: string; ok?: boolean; detail?: string };

const lengthRule = { short: '보통 1~3문장으로 짧게', normal: '필요한 만큼, 대개 한 문단 이내로', long: '자세하게, 단계별로' } as const;

// The system prompt: the shared base, then this character's profile.
export const buildSystemPrompt = (config: ChatConfig, request: Pick<ChatRequest, 'characterId' | 'character' | 'packPersona' | 'nickname' | 'status' | 'members'>) => {
  const profile = profileSchema.parse(config.profiles[request.characterId] ?? {});
  const persona = profile.persona?.trim() || request.packPersona || '다정하고 밝은 성격.';
  const call = profile.callUser?.trim() || request.nickname;
  return [
    config.basePrompt.trim() || DEFAULT_BASE_PROMPT,
    '',
    `[캐릭터] 이름: ${request.character}`,
    `성격·말투: ${persona}`,
    `${profile.speech ? `${profile.speech === 'jondaet' ? '존댓말' : '반말'}로, ` : ''}${lengthRule[profile.length]} 대답해.${profile.emoji ? ' 이모지는 가끔 써도 좋아.' : ' 이모지는 쓰지 마.'}`,
    call ? `사용자를 "${call}"라고 불러.` : '',
    profile.extra?.trim() ? `추가 지시: ${profile.extra.trim()}` : '',
    request.members && request.members.length > 1
      ? `[그룹 대화] 사용자와 ${request.members.join(', ')}가 함께 이야기 중이야. 너는 ${request.character}야. 다른 참가자의 말은 "[이름] 내용"으로 보여. 네 대사만, 이름표 없이 말해. 다른 캐릭터와도 자연스럽게 주고받아.`
      : '',
    '',
    `[참고: 지금 상황] ${request.status}`,
    '(위 상황은 배경으로만 알고 있어. 사용자가 묻거나 대화와 관련 있을 때만 꺼내.)'
  ].filter((line, i, all) => line !== '' || (all[i - 1] ?? '') !== '').join('\n');
};

export const isChatProvider = (value: unknown): value is ChatProvider =>
  typeof value === 'string' && (CHAT_PROVIDERS as readonly string[]).includes(value);

// Validates what the renderer sends before it reaches a model or a command line.
export const parseChatRequest = (input: unknown): ChatRequest => {
  const source = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const messages = Array.isArray(source.messages) ? source.messages : [];
  const clean = messages
    .filter((m): m is { role: 'user' | 'pet'; text: string } => typeof m === 'object' && m !== null && (m.role === 'user' || m.role === 'pet') && typeof m.text === 'string')
    .map((m) => ({ role: m.role, text: m.text.slice(0, 4000) }))
    .slice(-30);
  if (clean.length === 0 || clean[clean.length - 1].role !== 'user' || !clean[clean.length - 1].text.trim()) throw new Error('보낼 메시지가 없어요');
  const str = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : undefined);
  return {
    messages: clean,
    characterId: str(source.characterId, 48) ?? '',
    character: str(source.character, 40) ?? '펫',
    packPersona: str(source.packPersona, 800),
    nickname: str(source.nickname, 40),
    status: str(source.status, 400) ?? '',
    members: Array.isArray(source.members) ? source.members.filter((m): m is string => typeof m === 'string').map((m) => m.slice(0, 40)).slice(0, 8) : undefined
  };
};
