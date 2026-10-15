import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseMod, type Mod } from '../../shared/mods';
import { createModRunner, holds, matches, withModStates, type ModContext, type Primitives } from './mods';

const ctx: ModContext = { characterId: 'lila', timerMode: 'idle', musicPlaying: false, walking: false, hour: 14 };
const flush = () => new Promise((r) => setTimeout(r, 0));

const record = () => {
  const log: string[] = [];
  const primitives: Primitives = {
    play: (state, ms, fx) => log.push(`play ${state} ${ms}${fx ? ' ' + fx : ''}`),
    say: (line) => log.push(`say ${line}`),
    fx: (kind) => log.push(`fx ${kind}`),
    face: (face) => log.push(`face ${face}`),
    walk: async (dx, dy) => { log.push(`walk ${dx},${dy}`); },
    action: (id) => log.push(`action ${id}`),
    wait: async () => {}
  };
  return { log, primitives };
};

const mod = (behaviors: unknown[], extra: Record<string, unknown> = {}): Mod =>
  parseMod({ format: 'study-pet-mod@1', id: 'test', name: 'Test', behaviors, ...extra });

describe('mods', () => {
  it('validates blocks and rejects unknown ones', () => {
    expect(() => mod([{ id: 'a', when: { block: 'tap' }, do: [{ block: 'say', lines: ['hi'] }] }])).not.toThrow();
    expect(() => mod([{ id: 'a', when: { block: 'tap' }, do: [{ block: 'eval', code: 'x' }] }])).toThrow();
    expect(() => mod([{ id: 'a', when: { block: 'teleport' }, do: [{ block: 'stop' }] }])).toThrow();
  });

  it('matches triggers and evaluates nested conditions', () => {
    expect(matches({ block: 'tap', area: 'head' }, { type: 'tap', area: 'head' })).toBe(true);
    expect(matches({ block: 'tap', area: 'head' }, { type: 'tap', area: 'belly' })).toBe(false);
    expect(matches({ block: 'tap' }, { type: 'tap', area: 'belly' })).toBe(true);
    expect(holds({ block: 'hours', from: 22, to: 6 }, { ...ctx, hour: 23 }, Math.random)).toBe(true);
    expect(holds({ block: 'not', if: { block: 'timer', mode: 'focus' } }, ctx, Math.random)).toBe(true);
    expect(holds({ block: 'chance', p: 0.5 }, ctx, () => 0.7)).toBe(false);
  });

  it('runs steps in order, with random branches and repeats', async () => {
    const { log, primitives } = record();
    const runner = createModRunner(primitives, () => 0);
    runner.load([mod([{ id: 'pat', when: { block: 'tap', area: 'head' }, do: [
      { block: 'play', state: 'patted', ms: 500, fx: 'hearts' },
      { block: 'say', lines: ['헤헤', '좋아'] },
      { block: 'random', branches: [[{ block: 'action', id: 'giggle' }], [{ block: 'stop' }]] },
      { block: 'repeat', times: 2, do: [{ block: 'walk', dx: 10, dy: 0 }] }
    ] }])], 'lila');
    expect(runner.fire({ type: 'tap', area: 'head' }, ctx, 0)).toBe(true);
    await flush();
    expect(log).toEqual(['play patted 500 hearts', 'say 헤헤', 'action giggle', 'walk 10,0', 'walk 10,0']);
  });

  it('honours cooldowns, priorities, character filters and random intervals', async () => {
    const { log, primitives } = record();
    const runner = createModRunner(primitives, () => 0);
    runner.load([
      mod([
        { id: 'low', when: { block: 'tap' }, do: [{ block: 'say', lines: ['low'] }] },
        { id: 'high', when: { block: 'tap' }, priority: 5, cooldownMs: 1000, do: [{ block: 'say', lines: ['high'] }] },
        { id: 'tick', when: { block: 'random', everyMs: [1000, 2000] }, do: [{ block: 'say', lines: ['tick'] }] }
      ]),
      mod([{ id: 'other', when: { block: 'tap' }, priority: 9, do: [{ block: 'say', lines: ['moa only'] }] }], { id: 'moa-only', characters: ['moa'] })
    ], 'lila');
    runner.fire({ type: 'tap' }, ctx, 0);
    await flush();
    runner.fire({ type: 'tap' }, ctx, 500); // high is cooling down → low
    await flush();
    expect(runner.fire({ type: 'tick' }, ctx, 0)).toBe(false); // schedules first
    expect(runner.fire({ type: 'tick' }, ctx, 999)).toBe(false);
    expect(runner.fire({ type: 'tick' }, ctx, 1000)).toBe(true);
    await flush();
    expect(log).toEqual(['say high', 'say low', 'say tick']);
  });

  it('runs before/after event hooks, letting the caller wait for before', async () => {
    const { log, primitives } = record();
    const runner = createModRunner(primitives, () => 0);
    runner.load([mod([
      { id: 'b', when: { block: 'event', name: 'walk', phase: 'before' }, do: [{ block: 'say', lines: ['before'] }, { block: 'wait', ms: 10 }] },
      { id: 'a', when: { block: 'event', name: 'walk', phase: 'after' }, do: [{ block: 'say', lines: ['after'] }] }
    ])], 'lila');
    await runner.run({ type: 'event', name: 'walk', phase: 'before' }, ctx, 0);
    log.push('walking');
    await runner.run({ type: 'event', name: 'walk', phase: 'after' }, ctx, 1);
    expect(log).toEqual(['say before', 'walking', 'say after']);
    expect(await runner.run({ type: 'event', name: 'drag', phase: 'before' }, ctx, 2)).toBe(false);
  });

  it('adds mod states to the pack and lists menu items', () => {
    const states = withModStates({ states: { idle: { loop: [{ ms: 100 }] } } } as never, [
      mod([], { states: { spin: { loop: [{ ms: 120, head: 'turnL' }] } } })
    ]).states;
    expect(Object.keys(states)).toEqual(['idle', 'spin']);
    const runner = createModRunner(record().primitives);
    runner.load([mod([{ id: 'dance', when: { block: 'menu', label: '춤춰줘' }, do: [{ block: 'stop' }] }])], 'lila');
    expect(runner.menuItems()).toEqual(['춤춰줘']);
  });

  it('ships built-in mods that validate', () => {
    for (const id of readdirSync('assets/mods').filter((d) => !d.startsWith('_'))) {
      expect(() => parseMod(JSON.parse(readFileSync(`assets/mods/${id}/mod.json`, 'utf8')))).not.toThrow();
    }
  });

  it('rolls a friend stay trigger once per visit and runs talk', async () => {
    const { log, primitives } = record();
    const runner = createModRunner({ ...primitives, talk: async (turns) => { log.push(`talk ${turns}`); } }, () => 0);
    runner.load([mod([{ id: 'meet', when: { block: 'friend', phase: 'stay', afterMs: 1000 }, do: [{ block: 'talk', turns: 6 }] }])], 'lila');
    const stay = (nearMs: number, visit: number) => runner.fire({ type: 'friend', phase: 'stay', id: 'moa', nearMs, visit }, ctx, nearMs);
    expect(stay(500, 1)).toBe(false); // not long enough yet
    expect(stay(1500, 1)).toBe(true);
    await flush();
    expect(stay(2000, 1)).toBe(false); // same visit
    expect(stay(1500, 2)).toBe(true); // a new visit
    await flush();
    expect(log).toEqual(['talk 6', 'talk 6']);
  });
});
