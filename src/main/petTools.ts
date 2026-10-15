import * as z from 'zod/v4';
import { formatMinutes, lastDateKeys } from '../shared/stats';
import type { Repository } from './db/repository';
import type { PetCommand, ToolGroup } from '../shared/chat';

export type { PetCommand, ToolGroup };

// Everything the AI can do in the app, defined once. The chat agent binds
// these as LangChain tools (main/chatAgent.ts) and the MCP server exposes the
// same list to Claude Code, Codex, Cursor… (main/mcpTools.ts). Kept free of
// Electron so they can be tested against an in-memory database.

export type TimerCommand = 'start' | 'stop' | 'pause' | 'resume';

export type ToolBridge = {
  sendTimerCommand: (command: TimerCommand) => void;
  notifyChanged: (kind: 'todos' | 'notes' | 'stats' | 'settings') => void;
  todayKey: () => string;
  petCommand?: (command: PetCommand) => void;
  listCharacters?: () => Promise<{ id: string; name: string }[]>;
  listMods?: () => Promise<{ id: string; name: string; enabled: boolean; description?: string }[]>;
  setModEnabled?: (id: string, enabled: boolean) => void;
};

export type PetTool = {
  name: string;
  // Shown in Settings › AI 대화 › 도구.
  label: string;
  group: ToolGroup;
  // Changes something (off unless the user allows writes).
  write: boolean;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  run: (input: any) => Promise<unknown>;
  // Only for outside AIs over MCP (the pet's own chat doesn't get these).
  mcpOnly?: boolean;
};

type StoredSession = { id: string; characterId: string; members?: string[]; title: string; updatedAt: number; messages: { role: string; text: string; speaker?: string }[] };

export class ToolError extends Error {}

type SessionSnapshot = { state?: { timer?: { mode: string; endsAt: number | null; pausedAt?: number | null }; activeTodoId?: string | null } };

const dayStart = (key: string) => new Date(`${key}T00:00:00`).getTime();
const inRange = (time: number, from?: string, to?: string) =>
  (!from || time >= dayStart(from)) && (!to || time < dayStart(to) + 86_400_000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Settings the AI may change (the rest are appearance and placement).
const settingsPatch = z.object({
  focusMinutes: z.number().int().min(1).max(120).optional(),
  breakMinutes: z.number().int().min(1).max(60).optional(),
  longBreakMinutes: z.number().int().min(1).max(90).optional(),
  longBreakEvery: z.number().int().min(2).max(10).optional(),
  dailyGoalSessions: z.number().int().min(1).max(24).optional(),
  autoStartFocus: z.boolean().optional(),
  musicSync: z.boolean().optional(),
  musicVolume: z.number().int().min(0).max(100).optional(),
  walkAround: z.boolean().optional(),
  eyesFollowCursor: z.boolean().optional()
});

export const createPetTools = (repo: Repository, bridge: ToolBridge): PetTool[] => {
  const todo = (id: string) => {
    const found = repo.listTodos().find((t) => t.id === id);
    if (!found) throw new ToolError(`No todo with id ${id}.`);
    return found;
  };
  const note = (id: string) => {
    const found = repo.listNotes('').find((n) => n.id === id);
    if (!found) throw new ToolError(`No note with id ${id}.`);
    return found;
  };
  const sessions = (): StoredSession[] => {
    try { return JSON.parse(repo.getKv('chat.sessions') ?? '[]'); } catch { return []; }
  };
  const brief = (n: ReturnType<typeof note>) => ({ id: n.id, title: n.title, body: n.body, pinned: n.pinned, updatedAt: new Date(n.updatedAt).toISOString() });

  return [
    // ---------- info ----------
    {
      name: 'get_now', label: '현재 날짜·시간', group: 'info', write: false,
      description: 'Current local date, time and weekday.',
      schema: z.object({}),
      run: async () => {
        const now = new Date();
        return { date: bridge.todayKey(), time: now.toTimeString().slice(0, 5), weekday: now.toLocaleDateString('ko-KR', { weekday: 'long' }) };
      }
    },

    // ---------- todos ----------
    {
      name: 'list_todos', label: '할 일 보기', group: 'todos', write: false,
      description: 'List the study todos with completion state and pomodoro counts (estimate vs. done). Optional date range on creation date.',
      schema: z.object({
        include_done: z.boolean().optional().describe('Include completed todos (default true)'),
        from: date.optional().describe('Created on or after (YYYY-MM-DD)'),
        to: date.optional().describe('Created on or before (YYYY-MM-DD)')
      }),
      run: async ({ include_done = true, from, to }: { include_done?: boolean; from?: string; to?: string }) =>
        repo.listTodos()
          .filter((t) => (include_done || !t.done) && inRange(t.createdAt, from, to))
          .map(({ id, title, done, estimate, pomodoros, createdAt }) => ({ id, title, done, estimate, pomodoros, created: new Date(createdAt).toISOString().slice(0, 10) }))
    },
    {
      name: 'add_todo', label: '할 일 추가', group: 'todos', write: true,
      description: 'Add a study todo. `estimate` is the expected number of 25-minute pomodoros.',
      schema: z.object({ title: z.string().min(1).max(80), estimate: z.number().int().min(1).max(12).optional() }),
      run: async ({ title, estimate }: { title: string; estimate?: number }) => {
        const added = repo.addTodo(title, estimate ?? 1);
        if (!added) throw new ToolError('Title must not be empty.');
        bridge.notifyChanged('todos');
        return { id: added.id, title: added.title, estimate: added.estimate };
      }
    },
    {
      name: 'update_todo', label: '할 일 수정', group: 'todos', write: true,
      description: 'Rename a todo or change its pomodoro estimate.',
      schema: z.object({ id: z.string(), title: z.string().min(1).max(80).optional(), estimate: z.number().int().min(1).max(12).optional() }),
      run: async ({ id, title, estimate }: { id: string; title?: string; estimate?: number }) => {
        todo(id);
        repo.updateTodo(id, { title, estimate });
        bridge.notifyChanged('todos');
        const updated = todo(id);
        return { id, title: updated.title, estimate: updated.estimate };
      }
    },
    {
      name: 'complete_todo', label: '할 일 완료', group: 'todos', write: true,
      description: 'Mark a todo as done (or not done) by id.',
      schema: z.object({ id: z.string(), done: z.boolean().optional() }),
      run: async ({ id, done = true }: { id: string; done?: boolean }) => {
        todo(id);
        repo.setTodoDone(id, done);
        bridge.notifyChanged('todos');
        return done ? 'Marked done.' : 'Marked not done.';
      }
    },
    {
      name: 'delete_todo', label: '할 일 삭제', group: 'todos', write: true,
      description: 'Delete a todo by id. Ask the user first unless they clearly asked for it.',
      schema: z.object({ id: z.string() }),
      run: async ({ id }: { id: string }) => {
        const removed = todo(id);
        repo.deleteTodo(id);
        bridge.notifyChanged('todos');
        return `Deleted "${removed.title}".`;
      }
    },
    {
      name: 'clear_completed_todos', label: '완료한 할 일 정리', group: 'todos', write: true,
      description: 'Remove all completed todos.',
      schema: z.object({}),
      run: async () => {
        repo.clearCompletedTodos();
        bridge.notifyChanged('todos');
        return 'Cleared completed todos.';
      }
    },

    // ---------- notes ----------
    {
      name: 'list_notes', label: '메모 보기', group: 'notes', write: false,
      description: 'List or search memo notes (title and body), newest first. Optional date range on last update.',
      schema: z.object({
        query: z.string().max(80).optional(),
        from: date.optional().describe('Updated on or after (YYYY-MM-DD)'),
        to: date.optional().describe('Updated on or before (YYYY-MM-DD)'),
        pinned_only: z.boolean().optional()
      }),
      run: async ({ query = '', from, to, pinned_only }: { query?: string; from?: string; to?: string; pinned_only?: boolean }) =>
        repo.listNotes(query).filter((n) => inRange(n.updatedAt, from, to) && (!pinned_only || n.pinned)).map(brief)
    },
    {
      name: 'add_note', label: '메모 작성', group: 'notes', write: true,
      description: 'Create a memo note in the pet app.',
      schema: z.object({ title: z.string().max(80), body: z.string().max(20000).optional(), pinned: z.boolean().optional() }),
      run: async ({ title, body = '', pinned }: { title: string; body?: string; pinned?: boolean }) => {
        const created = repo.createNote(title, body);
        if (!created) throw new ToolError('Note must have a title or body.');
        if (pinned) repo.updateNote(created.id, { pinned: true });
        bridge.notifyChanged('notes');
        return { id: created.id, title: created.title };
      }
    },
    {
      name: 'update_note', label: '메모 수정', group: 'notes', write: true,
      description: 'Edit a memo: replace title/body, append text to the body, or pin/unpin it.',
      schema: z.object({
        id: z.string(), title: z.string().max(80).optional(), body: z.string().max(20000).optional(),
        append: z.string().max(5000).optional().describe('Text added at the end of the body'), pinned: z.boolean().optional()
      }),
      run: async ({ id, title, body, append, pinned }: { id: string; title?: string; body?: string; append?: string; pinned?: boolean }) => {
        const current = note(id);
        const nextBody = append ? `${body ?? current.body}${current.body || body ? '\n' : ''}${append}` : body;
        repo.updateNote(id, { title, body: nextBody, pinned });
        bridge.notifyChanged('notes');
        return brief(note(id));
      }
    },
    {
      name: 'delete_note', label: '메모 삭제', group: 'notes', write: true,
      description: 'Delete a memo by id. Ask the user first unless they clearly asked for it.',
      schema: z.object({ id: z.string() }),
      run: async ({ id }: { id: string }) => {
        const removed = note(id);
        repo.deleteNote(id);
        bridge.notifyChanged('notes');
        return `Deleted "${removed.title || '(제목 없음)'}".`;
      }
    },

    // ---------- timer & stats ----------
    {
      name: 'get_timer', label: '타이머 보기', group: 'timer', write: false,
      description: 'Current pomodoro timer state: mode (idle/focus/break), remaining seconds, paused, active todo.',
      schema: z.object({}),
      run: async () => {
        const raw = repo.getKv('session');
        const snapshot = (raw ? JSON.parse(raw) : {}) as SessionSnapshot;
        const timer = snapshot.state?.timer;
        if (!timer || timer.mode === 'idle' || timer.endsAt === null) return { mode: 'idle' };
        const reference = timer.pausedAt ?? Date.now();
        const active = repo.listTodos().find((t) => t.id === snapshot.state?.activeTodoId);
        return {
          mode: timer.mode,
          remainingSeconds: Math.max(0, Math.round((timer.endsAt - reference) / 1000)),
          paused: timer.pausedAt != null,
          activeTodo: active ? { id: active.id, title: active.title } : null
        };
      }
    },
    {
      name: 'control_timer', label: '타이머 조작', group: 'timer', write: true,
      description: 'Start a focus session, stop (abandon) it, or pause/resume the running timer in the desktop pet.',
      schema: z.object({ command: z.enum(['start', 'stop', 'pause', 'resume']) }),
      run: async ({ command }: { command: TimerCommand }) => {
        bridge.sendTimerCommand(command);
        return `Sent "${command}" to the pet timer.`;
      }
    },
    {
      name: 'get_stats', label: '집중 통계', group: 'stats', write: false,
      description: 'Focus statistics for the last N days: minutes and sessions per day, completion rate, pauses, average focus rating.',
      schema: z.object({ days: z.number().int().min(1).max(90).optional() }),
      run: async ({ days = 7 }: { days?: number }) => {
        const keys = lastDateKeys(bridge.todayKey(), days);
        const daily = repo.getDailyFocus(keys[0], keys[keys.length - 1]);
        const summary = repo.getSessionSummary(keys[0], keys[keys.length - 1]);
        const total = daily.reduce((sum, d) => sum + d.minutes, 0);
        return { from: keys[0], to: keys[keys.length - 1], totalFocus: formatMinutes(total), totalMinutes: total, daily, ...summary };
      }
    },

    // ---------- settings ----------
    {
      name: 'get_settings', label: '설정 보기', group: 'settings', write: false,
      description: 'Timer lengths, daily goal, music and pet behaviour settings.',
      schema: z.object({}),
      run: async () => {
        const s = repo.getSettings();
        return Object.fromEntries(Object.keys(settingsPatch.shape).map((k) => [k, s[k as keyof typeof s]]));
      }
    },
    {
      name: 'update_settings', label: '설정 바꾸기', group: 'settings', write: true,
      description: 'Change timer lengths (minutes), long break cadence, daily goal sessions, auto start, music sync/volume, wandering and eye following.',
      schema: settingsPatch,
      run: async (patch: z.infer<typeof settingsPatch>) => {
        repo.updateSettings(patch);
        bridge.notifyChanged('settings');
        return `Updated ${Object.keys(patch).join(', ') || 'nothing'}.`;
      }
    },

    // ---------- music ----------
    {
      name: 'list_playlists', label: '플레이리스트 보기', group: 'music', write: false,
      description: 'The music playlists and how many tracks each has.',
      schema: z.object({}),
      run: async () => repo.listPlaylists().map((p) => ({ id: p.id, name: p.name, tracks: p.items.length }))
    },
    {
      name: 'control_music', label: '음악 조작', group: 'music', write: true,
      description: 'Play, pause or skip to the next track in the pet music player.',
      schema: z.object({ action: z.enum(['play', 'pause', 'next']) }),
      run: async ({ action }: { action: 'play' | 'pause' | 'next' }) => {
        bridge.petCommand?.({ type: 'music', action });
        return `Sent "${action}" to the music player.`;
      }
    },

    // ---------- the pet ----------
    {
      name: 'pet_express', label: '표정·동작', group: 'pet', write: false,
      description: 'Make yourself (the pet) react visibly: an effect (hearts, stars, sparkles, sweat, anger), a face (smile, laugh, closed, focused…) or a pack action id. Use it naturally, not every turn.',
      schema: z.object({
        fx: z.enum(['hearts', 'stars', 'sparkles', 'sweat', 'anger']).optional(),
        face: z.string().max(40).optional(),
        action: z.string().max(40).optional(),
        ms: z.number().int().min(300).max(6000).optional()
      }),
      run: async (input: { fx?: string; face?: string; action?: string; ms?: number }) => {
        bridge.petCommand?.({ type: 'express', ...input });
        return 'Done.';
      }
    },
    {
      name: 'list_characters', label: '캐릭터 목록', group: 'pet', write: false,
      description: 'Characters installed in the app (the user can switch between them).',
      schema: z.object({}),
      run: async () => (await bridge.listCharacters?.()) ?? []
    },
    {
      name: 'switch_character', label: '캐릭터 바꾸기', group: 'pet', write: true,
      description: 'Switch the desktop pet to another installed character by id.',
      schema: z.object({ id: z.string() }),
      run: async ({ id }: { id: string }) => {
        const list = (await bridge.listCharacters?.()) ?? [];
        if (!list.some((c) => c.id === id)) throw new ToolError(`No character with id ${id}.`);
        bridge.petCommand?.({ type: 'character', id });
        return `Switching to ${id}.`;
      }
    },
    {
      name: 'list_mods', label: '모드 목록', group: 'pet', write: false,
      description: 'Behaviour mods installed in the app and whether each is on.',
      schema: z.object({}),
      run: async () => (await bridge.listMods?.()) ?? []
    },
    // ---------- chat sessions (outside AIs joining the pet's conversations) ----------
    {
      name: 'list_chat_sessions', label: '대화 세션 목록', group: 'chat', write: false, mcpOnly: true,
      description: "List the pet app's chat sessions (conversations between the user and the desktop pet characters), newest first.",
      schema: z.object({}),
      run: async () => sessions().map((s) => ({ id: s.id, title: s.title, members: s.members ?? [s.characterId], messages: s.messages.length, updated: new Date(s.updatedAt).toISOString() }))
    },
    {
      name: 'read_chat_session', label: '대화 세션 읽기', group: 'chat', write: false, mcpOnly: true,
      description: 'Read the latest messages of a chat session. Speakers: "user", a character id, or "guest:<name>" for outside AIs.',
      schema: z.object({ session_id: z.string(), last: z.number().int().min(1).max(100).optional() }),
      run: async ({ session_id, last = 30 }: { session_id: string; last?: number }) => {
        const session = sessions().find((s) => s.id === session_id);
        if (!session) throw new ToolError(`No chat session with id ${session_id}.`);
        return session.messages.filter((m) => m.role !== 'tool').slice(-last)
          .map((m) => ({ speaker: m.role === 'user' ? 'user' : m.speaker ?? session.characterId, text: m.text }));
      }
    },
    {
      name: 'post_chat_message', label: '대화 세션에 말하기', group: 'chat', write: true, mcpOnly: true,
      description: 'Join a chat session as a guest and say something. With reply=true the pet characters in the session answer; read the session again after a few seconds to see them.',
      schema: z.object({ session_id: z.string(), name: z.string().min(1).max(24).describe('Your display name, e.g. "Claude Code"'), text: z.string().min(1).max(2000), reply: z.boolean().optional() }),
      run: async ({ session_id, name, text, reply = true }: { session_id: string; name: string; text: string; reply?: boolean }) => {
        if (!sessions().some((s) => s.id === session_id)) throw new ToolError(`No chat session with id ${session_id}.`);
        if (!bridge.petCommand) throw new ToolError('The pet app is not running.');
        bridge.petCommand({ type: 'chat-post', sessionId: session_id, name, text, reply });
        return reply ? 'Posted. The characters will answer; read the session again in a few seconds.' : 'Posted.';
      }
    },
    {
      name: 'toggle_mod', label: '모드 켜기·끄기', group: 'pet', write: true,
      description: 'Turn a behaviour mod on or off by id.',
      schema: z.object({ id: z.string(), enabled: z.boolean() }),
      run: async ({ id, enabled }: { id: string; enabled: boolean }) => {
        const list = (await bridge.listMods?.()) ?? [];
        if (!list.some((m) => m.id === id)) throw new ToolError(`No mod with id ${id}.`);
        bridge.setModEnabled?.(id, enabled);
        return `${enabled ? 'Enabled' : 'Disabled'} ${id}.`;
      }
    }
  ];
};

// Runs a tool with validated input; errors come back as text for the model.
export const runPetTool = async (tool: PetTool, input: unknown): Promise<{ ok: boolean; text: string }> => {
  const parsed = tool.schema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, text: `Invalid input: ${parsed.error.message}` };
  try {
    const result = await tool.run(parsed.data);
    return { ok: true, text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) };
  } catch (error) {
    return { ok: false, text: error instanceof Error ? error.message : String(error) };
  }
};
