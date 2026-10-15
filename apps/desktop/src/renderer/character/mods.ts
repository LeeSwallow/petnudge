// Runs mod behaviours: picks the behaviours a trigger fires, checks their
// conditions and cooldowns, and plays their steps through injected
// primitives. Pure apart from those primitives, so it is testable.
import type { CharacterPack } from '../../shared/characterPack';
import type { Behavior, DoBlock, IfBlock, Mod, WhenBlock } from '../../shared/mods';

export type ModContext = {
  characterId: string;
  timerMode: 'idle' | 'focus' | 'break';
  musicPlaying: boolean;
  walking: boolean;
  hour: number;
};

// What steps can do; the pet wires these to drawing, the bubble and walking.
export type Primitives = {
  play: (state: string, ms: number, fx?: string, line?: string) => void;
  say: (line: string) => void;
  fx: (kind: string, ms: number) => void;
  face: (face: string, ms: number) => void;
  walk: (dx: number, dy: number) => Promise<void>;
  action: (id: string) => void;
  wait: (ms: number) => Promise<void>;
  // Face the friend nearby and chat with it (resolves when the chat ends).
  talk?: (turns: number, topic?: string) => Promise<void>;
};

// Adds mod states to a copy of the pack (a mod may override a pack state).
export const withModStates = (pack: CharacterPack, mods: Mod[]): CharacterPack => {
  const states = { ...pack.states };
  for (const mod of mods) Object.assign(states, mod.states ?? {});
  return { ...pack, states };
};

export const appliesTo = (mod: Mod, characterId: string) => mod.characters.includes('*') || mod.characters.includes(characterId);

const inHours = (hour: number, from: number, to: number) => (from <= to ? hour >= from && hour < to : hour >= from || hour < to);

export const holds = (cond: IfBlock, ctx: ModContext, random: () => number): boolean => {
  switch (cond.block) {
    case 'chance': return random() < cond.p;
    case 'timer': return ctx.timerMode === cond.mode;
    case 'hours': return inHours(ctx.hour, cond.from, cond.to);
    case 'music': return ctx.musicPlaying === cond.playing;
    case 'character': return cond.ids.includes(ctx.characterId);
    case 'walking': return ctx.walking === cond.value;
    case 'not': return !holds(cond.if, ctx, random);
  }
};

// Whether a trigger event matches a behaviour's `when`.
export type ModEvent =
  | { type: 'tap'; area?: string }
  | { type: 'menu'; label: string }
  | { type: 'timer'; event: 'focusStart' | 'focusEnd' | 'breakStart' | 'breakEnd' }
  | { type: 'music'; playing: boolean }
  | { type: 'drag'; phase: 'start' | 'end' }
  | { type: 'time'; hour: number }
  | { type: 'idle'; idleMs: number }
  | { type: 'event'; name: string; phase: 'before' | 'after' }
  // `visit`: when this stay near began (stay triggers fire once per visit).
  | { type: 'friend'; phase: 'near' | 'leave' | 'stay'; id: string; nearMs: number; visit: number }
  | { type: 'tick' }; // random triggers are checked on ticks

export const matches = (when: WhenBlock, event: ModEvent) => {
  switch (when.block) {
    case 'tap': return event.type === 'tap' && (!when.area || when.area === event.area);
    case 'menu': return event.type === 'menu' && event.label === when.label;
    case 'timer': return event.type === 'timer' && event.event === when.event;
    case 'music': return event.type === 'music' && event.playing === when.playing;
    case 'drag': return event.type === 'drag' && event.phase === when.phase;
    case 'time': return event.type === 'time' && event.hour === when.hour;
    case 'idle': return event.type === 'idle' && event.idleMs >= when.afterMs;
    case 'random': return event.type === 'tick';
    case 'event': return event.type === 'event' && event.name === when.name && event.phase === when.phase;
    case 'friend': return event.type === 'friend' && event.phase === when.phase && (!when.who || when.who === event.id)
      && (when.phase !== 'stay' || event.nearMs >= (when.afterMs ?? 0));
  }
};

type Entry = { mod: string; behavior: Behavior };

export const createModRunner = (primitives: Primitives, random: () => number = Math.random) => {
  let entries: Entry[] = [];
  const lastRun = new Map<string, number>();
  const nextRandom = new Map<string, number>(); // random triggers: when each may fire next
  const idleFired = new Set<string>();
  const stayFired = new Set<string>(); // `${behaviour}@${visit}`
  let running: { key: string; priority: number; token: { cancelled: boolean } } | null = null;

  const key = (e: Entry) => `${e.mod}/${e.behavior.id}`;

  const load = (mods: Mod[], characterId: string) => {
    entries = mods.filter((m) => appliesTo(m, characterId)).flatMap((m) => m.behaviors.map((behavior) => ({ mod: m.id, behavior })));
    nextRandom.clear();
    idleFired.clear();
  };

  const menuItems = () => entries.flatMap(({ behavior }) => (behavior.when.block === 'menu' ? [behavior.when.label] : []));

  const runSteps = async (steps: DoBlock[], token: { cancelled: boolean }): Promise<boolean> => {
    for (const step of steps) {
      if (token.cancelled) return false;
      switch (step.block) {
        case 'play': primitives.play(step.state, step.ms, step.fx, step.line); await primitives.wait(step.ms); break;
        case 'say': primitives.say(step.lines[Math.floor(random() * step.lines.length)]); break;
        case 'fx': primitives.fx(step.kind, step.ms); break;
        case 'face': primitives.face(step.face, step.ms); await primitives.wait(step.ms); break;
        case 'wait': await primitives.wait(step.ms); break;
        case 'walk': await primitives.walk(step.dx, step.dy); break;
        case 'action': primitives.action(step.id); break;
        case 'random': {
          const branch = step.branches[Math.floor(random() * step.branches.length)];
          if (!(await runSteps(branch, token))) return false;
          break;
        }
        case 'repeat':
          for (let i = 0; i < step.times; i++) if (!(await runSteps(step.do, token))) return false;
          break;
        case 'talk': if (primitives.talk) await primitives.talk(step.turns, step.topic); break;
        case 'stop': return false;
      }
    }
    return true;
  };

  // Fires an event: runs the best matching behaviour. Returns its run (which
  // settles when the steps end or are cancelled), or null if none ran.
  const start = (event: ModEvent, ctx: ModContext, now: number): Promise<boolean> | null => {
    const candidates = entries.filter((e) => {
      if (!matches(e.behavior.when, event)) return false;
      const k = key(e);
      if (e.behavior.when.block === 'random') {
        const at = nextRandom.get(k);
        const [lo, hi] = e.behavior.when.everyMs;
        if (at === undefined) { nextRandom.set(k, now + lo + random() * (hi - lo)); return false; }
        if (now < at) return false;
        nextRandom.set(k, now + lo + random() * (hi - lo));
      }
      if (e.behavior.when.block === 'idle') {
        if (idleFired.has(k)) return false;
      }
      const last = lastRun.get(k);
      if (last !== undefined && now - last < (e.behavior.cooldownMs ?? 0)) return false;
      // One roll per visit: a stay trigger that passes its time is used up,
      // whether or not its conditions (e.g. chance) hold.
      if (event.type === 'friend' && event.phase === 'stay') {
        const visit = `${k}@${event.id}@${event.visit}`;
        if (stayFired.has(visit)) return false;
        stayFired.add(visit);
      }
      return (e.behavior.if ?? []).every((c) => holds(c, ctx, random));
    }).sort((a, b) => (b.behavior.priority ?? 0) - (a.behavior.priority ?? 0));
    const chosen = candidates[0];
    if (!chosen) return null;
    const priority = chosen.behavior.priority ?? 0;
    if (running && running.priority > priority) return null;
    if (running) running.token.cancelled = true;
    const k = key(chosen);
    if (chosen.behavior.when.block === 'idle') idleFired.add(k);
    lastRun.set(k, now);
    const token = { cancelled: false };
    running = { key: k, priority, token };
    return runSteps(chosen.behavior.do, token).finally(() => { if (running?.token === token) running = null; });
  };
  const fire = (event: ModEvent, ctx: ModContext, now: number) => start(event, ctx, now) !== null;
  // For `before` hooks: resolves once the behaviour (if any) has finished.
  const run = async (event: ModEvent, ctx: ModContext, now: number) => (await start(event, ctx, now)) ?? false;

  return {
    load,
    fire,
    run,
    menuItems,
    // Interrupt whatever is running (drag, panel).
    cancel: () => { if (running) { running.token.cancelled = true; running = null; } },
    // Activity resets the once-per-idle triggers.
    resetIdle: () => idleFired.clear(),
    isRunning: () => running !== null
  };
};
