import { formatRemaining, getRemainingMs } from '../domain/pomodoro/timer';
import { api } from './api';
import { pack, setCharacter } from './character';
import { data, updateSettings } from './data';
import { music } from './music';
import { runAction } from './pet/behavior';
import { sayNow } from './pet/bubble';
import { around } from './pet/mods';
import { markActivity, scriptFace, scriptFx } from './pet/state';
import { petStore } from './store';
import {
  PROVIDER_INFO, parseChatConfig,
  type ChatConfig, type ChatEvent, type ChatMessage, type ChatProvider, type ChatProviderInfo, type ChatToolInfo, type PetCommand
} from '../shared/chat';

// The pet chat in the renderer: conversations as sessions, one list per
// character ("friend"), shared by the quick bar beside her (pet/chatbar.ts)
// and the 대화 tab (modules/chat.ts). Friends can be invited into a session;
// then each answers in turn (on its own provider, see the profile), they can
// talk among themselves, and outside AIs can join over MCP ('chat-post').
// Settings live in kv 'chat.config' and are read by main for every reply;
// replies run the `chat` mod event.

const SESSIONS_KEY = 'chat.sessions';
const CONFIG_KEY = 'chat.config';
const ACTIVE_KEY = 'chat.active';
const MAX_SESSIONS = 80;
const MAX_MESSAGES = 300;

export type ChatSession = {
  id: string;
  characterId: string; // who it started with
  members?: string[]; // everyone in it (characterId first); absent = just her
  mirror?: boolean; // show the group's lines in the pet's bubble (default on)
  meetup?: boolean; // where two pets chat when they meet on the desktop
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

type State = {
  config: ChatConfig;
  providers: ChatProviderInfo[];
  tools: ChatToolInfo[];
  sessions: ChatSession[];
  active: Record<string, string>; // characterId → session id
  pending: { id: string; sessionId: string; speaker: string } | null;
  busy: string | null; // session with replies still to come
  live: string; // the reply so far
};

export const chatState: State = { config: parseChatConfig({}), providers: [], tools: [], sessions: [], active: {}, pending: null, busy: null, live: '' };
const listeners = new Set<() => void>();
export const onChat = (listener: () => void) => listeners.add(listener);
const changed = () => listeners.forEach((listener) => listener());

const saveSessions = () => {
  chatState.sessions = chatState.sessions.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_SESSIONS);
  void api.db.setKv(SESSIONS_KEY, JSON.stringify(chatState.sessions));
  void api.db.setKv(ACTIVE_KEY, JSON.stringify(chatState.active));
};

export const providerLabel = (provider: ChatProvider = chatState.config.provider) => PROVIDER_INFO[provider].label;
export const chatAvailable = () => chatState.providers.find((p) => p.id === chatState.config.provider)?.available ?? false;

// ---------- settings ----------

export const saveChatConfig = (patch: Partial<ChatConfig>) => {
  chatState.config = parseChatConfig({ ...chatState.config, ...patch });
  void api.db.setKv(CONFIG_KEY, JSON.stringify(chatState.config)).then(refreshChatTools);
  changed();
};

export const refreshChatProviders = async (refresh = true) => {
  chatState.providers = await api.chatProviders(refresh);
  changed();
};

export const refreshChatTools = async () => {
  chatState.tools = await api.chatTools();
  changed();
};

// One short round trip outside any session, for Settings.
export const testChat = async () => {
  const started = Date.now();
  const reply = await api.sendChat(`test-${started}`, {
    messages: [{ role: 'user', text: '연결 테스트야. "연결됐어!"라고만 답해 줘.' }], characterId: pack.id, character: pack.name, status: '연결 테스트'
  });
  return { reply, ms: Date.now() - started };
};

// ---------- sessions ----------

export const sessionsFor = (characterId: string) => chatState.sessions.filter((s) => s.characterId === characterId);
export const sessionById = (id: string) => chatState.sessions.find((s) => s.id === id);

export const newSession = (characterId = pack.id) => {
  const now = Date.now();
  const session: ChatSession = { id: `s${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, characterId, title: '새 대화', createdAt: now, updatedAt: now, messages: [] };
  chatState.sessions.unshift(session);
  chatState.active[characterId] = session.id;
  saveSessions();
  changed();
  return session;
};

// The session the quick bar talks in: the last one opened for her.
export const activeSession = (characterId = pack.id) =>
  sessionById(chatState.active[characterId] ?? '') ?? sessionsFor(characterId)[0] ?? newSession(characterId);

export const openSession = (id: string) => {
  const session = sessionById(id);
  if (!session) return;
  chatState.active[session.characterId] = id;
  saveSessions();
  changed();
};

export const renameSession = (id: string, title: string) => {
  const session = sessionById(id);
  if (!session || !title.trim()) return;
  session.title = title.trim().slice(0, 40);
  saveSessions();
  changed();
};

export const deleteSession = (id: string) => {
  if (chatState.pending?.sessionId === id) cancelChat();
  chatState.sessions = chatState.sessions.filter((s) => s.id !== id);
  for (const [character, sessionId] of Object.entries(chatState.active)) if (sessionId === id) delete chatState.active[character];
  saveSessions();
  changed();
};

export const clearAllSessions = () => {
  cancelChat();
  chatState.sessions = [];
  chatState.active = {};
  saveSessions();
  changed();
};

// ---------- members ----------

let names: Record<string, string> = {};
let personas: Record<string, string | undefined> = {};
// Friends out on the desktop speak in their own bubbles (main/friends.ts).
export const friendsOnScreen = new Set<string>();
export const nameOf = (id: string) =>
  id.startsWith('guest:') ? id.slice(6) : id === pack.id ? pack.name : names[id] ?? id;
export const membersOf = (session: ChatSession) => session.members ?? [session.characterId];
export const refreshNames = async () => {
  const list = await api.listCharacters().catch(() => []);
  names = Object.fromEntries(list.map((c) => [c.id, c.name]));
  personas = Object.fromEntries(list.map((c) => [c.id, c.persona]));
};

export const inviteToSession = (id: string, characterId: string) => {
  const session = sessionById(id);
  if (!session || membersOf(session).includes(characterId)) return;
  session.members = [...membersOf(session), characterId];
  session.messages.push({ role: 'tool', text: `👋 ${nameOf(characterId)} 초대됨`, at: Date.now() });
  session.updatedAt = Date.now();
  saveSessions();
  changed();
};

export const removeFromSession = (id: string, characterId: string) => {
  const session = sessionById(id);
  if (!session || characterId === session.characterId) return;
  session.members = membersOf(session).filter((m) => m !== characterId);
  session.messages.push({ role: 'tool', text: `🚪 ${nameOf(characterId)} 나감`, at: Date.now() });
  saveSessions();
  changed();
};

export const setMirror = (id: string, on: boolean) => {
  const session = sessionById(id);
  if (!session) return;
  session.mirror = on;
  saveSessions();
  changed();
};

// ---------- talking ----------

// What she knows about right now, in a sentence.
const status = () => {
  const { timer } = petStore.getState();
  const now = new Date();
  const parts = [`${now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} ${now.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}`];
  if (timer.mode === 'focus') parts.push(`뽀모도로 집중 중 (남은 시간 ${formatRemaining(getRemainingMs(timer, Date.now()))})`);
  else if (timer.mode === 'break') parts.push('휴식 시간');
  else parts.push('타이머는 쉬는 중');
  const todos = data.todos.filter((t) => !t.done).length;
  parts.push(`남은 할 일 ${todos}개`);
  const playing = music.nowPlaying;
  if (playing?.state === 'playing' && playing.title) parts.push(`음악 "${playing.title}" 재생 중`);
  return parts.join(', ');
};

const short = (text: string) => (text.length > 120 ? `${text.slice(0, 118)}…` : text);

const toolLine = (session: ChatSession, event: Extract<ChatEvent, { type: 'tool' }>) => {
  const mark = event.ok === undefined ? '…' : event.ok ? '✓' : '✗';
  const text = `🔧 ${event.label} ${mark}`;
  // A finished call updates its "…" line.
  const last = [...session.messages].reverse().find((m) => m.role === 'tool' && m.text === `🔧 ${event.label} …`);
  if (last && event.ok !== undefined) last.text = text;
  else session.messages.push({ role: 'tool', text: event.ok === undefined ? `🔧 ${event.label} …` : text });
};

// The conversation as one speaker sees it: its own lines are its, everyone
// else's come in as "[이름] …" (merged, since models want turns to alternate).
export const historyFor = (session: ChatSession, speaker: string) => {
  const group = membersOf(session).length > 1 || session.messages.some((m) => m.speaker?.startsWith('guest:'));
  const user = data.settings.nickname || '사용자';
  const turns: { role: 'user' | 'pet'; text: string }[] = [];
  for (const m of session.messages) {
    if (m.role === 'tool') continue;
    const own = m.role === 'pet' && (m.speaker ?? session.characterId) === speaker;
    const role = own ? 'pet' : 'user';
    const text = !group || own ? m.text : `[${m.role === 'user' ? user : nameOf(m.speaker ?? session.characterId)}] ${m.text}`;
    const prev = turns[turns.length - 1];
    if (prev?.role === role) prev.text += `\n${text}`;
    else turns.push({ role, text });
  }
  if (turns[turns.length - 1]?.role !== 'user') turns.push({ role: 'user', text: group ? '(대화를 자연스럽게 이어가 줘)' : '(계속해 줘)' });
  return turns;
};

let stopRequested = false;

export const cancelChat = () => {
  stopRequested = true;
  if (chatState.pending) api.cancelChat(chatState.pending.id);
};

// One reply from one character. Returns false when it failed or was stopped.
const replyAs = async (session: ChatSession, speaker: string): Promise<boolean> => {
  const mine = speaker === pack.id;
  const mirror = !mine && session.mirror !== false && chatState.active[pack.id] === session.id;
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  chatState.pending = { id, sessionId: session.id, speaker };
  chatState.live = '';
  changed();
  if (mine) sayNow('음… 생각 중', 60_000);
  let ok = true;
  try {
    await around('chat', async () => {
      const members = membersOf(session);
      const reply = await api.sendChat(id, {
        messages: historyFor(session, speaker),
        characterId: speaker,
        character: nameOf(speaker),
        packPersona: mine ? pack.persona : personas[speaker],
        nickname: data.settings.nickname || undefined,
        status: status(),
        members: members.length > 1 ? members.map(nameOf) : undefined
      });
      // CLI providers only report a tool call starting; the reply means it ran.
      for (const m of session.messages) if (m.role === 'tool' && m.text.endsWith(' …')) m.text = `${m.text.slice(0, -2)} ✓`;
      session.messages.push({ role: 'pet', text: reply, speaker, at: Date.now() });
      if (mine) sayNow(short(reply), 10_000);
      else if (friendsOnScreen.has(speaker)) api.friendSay(speaker, short(reply), 10_000);
      else if (mirror) sayNow(short(`${nameOf(speaker)}: ${reply}`), 10_000);
    });
  } catch (error) {
    ok = false;
    const reason = error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error);
    session.messages.push({ role: 'pet', speaker, text: `(대답하지 못했어요: ${reason})`, at: Date.now() });
    if (mine) sayNow(reason === '멈췄어요' ? '알았어, 그만할게.' : '앗, 지금은 대답이 안 나와…', 3000);
  } finally {
    chatState.pending = null;
    chatState.live = '';
    session.updatedAt = Date.now();
    session.messages = session.messages.slice(-MAX_MESSAGES);
    saveSessions();
    changed();
  }
  return ok && !stopRequested;
};

// Runs replies one after another (each sees the ones before it).
const replies = async (session: ChatSession, speakers: string[]) => {
  stopRequested = false;
  chatState.busy = session.id;
  changed();
  try {
    for (const speaker of speakers) if (!(await replyAs(session, speaker))) break;
  } finally {
    chatState.busy = null;
    changed();
  }
};

// Who answers a user line: the members it @mentions, else everyone.
export const respondersFor = (session: ChatSession, text: string) => {
  const members = membersOf(session);
  const mentioned = members.filter((m) => text.includes(`@${nameOf(m)}`) || text.includes(`@${m}`));
  return mentioned.length ? mentioned : members;
};

export const sendChat = async (text: string, sessionId?: string) => {
  text = text.trim();
  if (!text || chatState.busy) return;
  markActivity();
  await refreshNames();
  const session = (sessionId && sessionById(sessionId)) || activeSession();
  if (session.messages.length === 0) session.title = text.slice(0, 24);
  session.messages.push({ role: 'user', text, at: Date.now() });
  session.updatedAt = Date.now();
  chatState.active[session.characterId] = session.id;
  await replies(session, respondersFor(session, text));
};

// The characters talk among themselves for a few turns (optionally on a
// topic), each on its own provider — LLMs talking to each other.
export const talkTogether = async (sessionId: string, turns: number, topic?: string) => {
  const session = sessionById(sessionId);
  if (!session || chatState.busy) return;
  const members = membersOf(session);
  if (members.length < 2) return;
  await refreshNames();
  if (topic?.trim()) session.messages.push({ role: 'user', text: `(주제) ${topic.trim()}`, at: Date.now() });
  const lastSpeaker = [...session.messages].reverse().find((m) => m.role === 'pet')?.speaker ?? session.characterId;
  const start = (members.indexOf(lastSpeaker) + 1) % members.length;
  await replies(session, Array.from({ length: turns }, (_, i) => members[(start + i) % members.length]));
};

// The session two characters chat in when they meet on the desktop.
export const meetupSession = (a: string, b: string) => {
  const found = chatState.sessions.find((s) => s.meetup && membersOf(s).length === 2 && membersOf(s).includes(a) && membersOf(s).includes(b));
  if (found) return found;
  const session = newSession(a);
  session.members = [a, b];
  session.meetup = true;
  session.title = `${nameOf(a)} & ${nameOf(b)} 수다`;
  saveSessions();
  return session;
};

// An outside AI said something in a session (MCP post_chat_message).
const guestPost = async (sessionId: string, name: string, text: string, reply: boolean) => {
  const session = sessionById(sessionId);
  if (!session) return;
  session.messages.push({ role: 'pet', speaker: `guest:${name.slice(0, 24)}`, text: text.slice(0, 2000), at: Date.now() });
  session.updatedAt = Date.now();
  saveSessions();
  changed();
  if (session.mirror !== false && chatState.active[pack.id] === session.id) sayNow(short(`${name}: ${text}`), 8000);
  if (reply && !chatState.busy) {
    await refreshNames();
    await replies(session, respondersFor(session, text));
  }
};

// Tools that need the running pet (main/petTools.ts → 'pet-command').
const runPetCommand = async (command: PetCommand) => {
  if (command.type === 'express') {
    const ms = command.ms ?? 1500;
    if (command.action && pack.actions?.[command.action]) runAction(command.action);
    if (command.fx) scriptFx(command.fx, ms);
    if (command.face) scriptFace(command.face, ms);
  } else if (command.type === 'music') {
    const playing = music.nowPlaying?.state === 'playing';
    if (command.action === 'next') await music.next();
    else if ((command.action === 'play') !== playing) await music.toggle();
  } else if (command.type === 'character') {
    await setCharacter(await api.getCharacter(command.id));
    await updateSettings({ characterId: command.id });
  } else if (command.type === 'chat-post') {
    await guestPost(command.sessionId, command.name, command.text, command.reply);
  }
};

export const startChat = async () => {
  api.onChatEvent((id, event) => {
    const pending = chatState.pending;
    if (pending?.id !== id) return;
    const session = sessionById(pending.sessionId);
    if (event.type === 'delta') chatState.live = event.text;
    else if (session) toolLine(session, event);
    changed();
  });
  api.onPetCommand((command) => void runPetCommand(command).catch(() => undefined));
  const read = async <T>(key: string, fallback: T): Promise<T> => {
    try { return JSON.parse((await api.db.getKv(key)) ?? 'null') ?? fallback; } catch { return fallback; }
  };
  chatState.config = parseChatConfig(await read(CONFIG_KEY, {}));
  chatState.sessions = await read<ChatSession[]>(SESSIONS_KEY, []);
  chatState.active = await read<Record<string, string>>(ACTIVE_KEY, {});
  // The single conversation from before sessions becomes the first one.
  const legacy = await read<ChatMessage[]>('chat.history', []);
  if (legacy.length && chatState.sessions.length === 0) {
    const session = newSession(pack.id);
    session.messages = legacy;
    session.title = legacy.find((m) => m.role === 'user')?.text.slice(0, 24) ?? '이전 대화';
    saveSessions();
    void api.db.removeKv('chat.history');
  }
  const legacyProvider = await api.db.getKv('chat.provider');
  if (legacyProvider === 'codex' && !(await api.db.getKv(CONFIG_KEY))) saveChatConfig({ provider: 'codex' });
  const showFriends = (ids: string[]) => {
    friendsOnScreen.clear();
    ids.forEach((id) => friendsOnScreen.add(id));
    changed();
  };
  api.onFriends(showFriends);
  showFriends(await api.listFriends());
  await Promise.all([refreshChatProviders(false), refreshChatTools(), refreshNames()]);
};
