import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { createRepository, type Repository } from './db/repository';
import { migrate } from './db/schema';
import { createMcpTools, type McpBridge } from './mcpTools';

const { DatabaseSync } = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

let repo: Repository;
let bridge: McpBridge & { sendTimerCommand: Mock<McpBridge['sendTimerCommand']>; notifyChanged: Mock<McpBridge['notifyChanged']> };
let tools: ReturnType<typeof createMcpTools>;

const parse = (result: { content: { text: string }[] }) => JSON.parse(result.content[0].text);

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  migrate(db);
  repo = createRepository(db);
  bridge = { sendTimerCommand: vi.fn<McpBridge['sendTimerCommand']>(), notifyChanged: vi.fn<McpBridge['notifyChanged']>(), todayKey: () => '2026-10-15' };
  tools = createMcpTools(repo, bridge);
});

describe('mcp tools', () => {
  it('adds and lists todos, notifying the UI', async () => {
    await tools.add_todo.handler({ title: '미적분 3단원', estimate: 2 });
    const todos = parse(await tools.list_todos.handler({}));

    expect(todos).toMatchObject([{ title: '미적분 3단원', estimate: 2, done: false, pomodoros: 0 }]);
    expect(bridge.notifyChanged).toHaveBeenCalledWith('todos');
  });

  it('completes todos and reports unknown ids as tool errors', async () => {
    const { id } = parse(await tools.add_todo.handler({ title: 'a' }));
    await tools.complete_todo.handler({ id });

    expect(parse(await tools.list_todos.handler({ include_done: false }))).toEqual([]);
    expect((await tools.complete_todo.handler({ id: 'nope' })).isError).toBe(true);
  });

  it('summarizes stats for the requested days', async () => {
    repo.recordFocusSession({
      todoId: null,
      startedAt: 0,
      endedAt: 1,
      plannedMinutes: 25,
      actualMinutes: 25,
      completed: true,
      pauseCount: 0,
      dateKey: '2026-10-15',
      hour: 9
    });
    const stats = parse(await tools.get_stats.handler({ days: 7 }));

    expect(stats).toMatchObject({ from: '2026-10-09', to: '2026-10-15', totalMinutes: 25, completed: 1 });
  });

  it('reads the persisted timer and forwards timer commands', async () => {
    expect(parse(await tools.get_timer.handler())).toEqual({ mode: 'idle' });

    const endsAt = Date.now() + 60_000;
    repo.setKv('session', JSON.stringify({ state: { timer: { mode: 'focus', endsAt, pausedAt: null }, activeTodoId: null } }));
    const timer = parse(await tools.get_timer.handler());
    expect(timer.mode).toBe('focus');
    expect(timer.remainingSeconds).toBeGreaterThan(55);

    await tools.control_timer.handler({ command: 'start' });
    expect(bridge.sendTimerCommand).toHaveBeenCalledWith('start');
  });

  it('creates and searches notes', async () => {
    await tools.add_note.handler({ title: '공식', body: '미분 = 기울기' });

    expect(parse(await tools.list_notes.handler({ query: '미분' }))).toMatchObject([{ title: '공식' }]);
    expect(bridge.notifyChanged).toHaveBeenCalledWith('notes');
  });
});
