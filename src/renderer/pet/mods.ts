import { api } from '../api';
import { onCharacterChange, pack, setModStates } from '../character';
import { createModRunner, type ModContext, type ModEvent } from '../character/mods';
import { music } from '../music';
import { petStore } from '../store';
import type { ModInfo, ModProblem, PetEvent } from '../../shared/mods';
import { sayNow } from './bubble';
import { pet, scriptFace, scriptFx, startScripted } from './state';

// Wires the mod runner (character/mods.ts) to the pet: loads enabled mods,
// turns what happens (taps, timer, music, idle, the clock…) into events, and
// gives steps their primitives. Actions run through `around()` so mods can
// hook `before`/`after` any of them.

type Walker = { walkBy: (dx: number, dy: number) => Promise<void>; facing: () => number };
let walker: Walker | null = null;
let runAction: (id: string) => void = () => {};
// behavior.ts hands these over (it owns walking and pack actions).
export const connectMods = (w: Walker, action: (id: string) => void) => {
  walker = w;
  runAction = action;
};

let talk: (turns: number, topic?: string) => Promise<void> = async () => {};
// pet/friends.ts hands over the meetup chat.
export const connectTalk = (fn: typeof talk) => {
  talk = fn;
};

const runner = createModRunner({
  talk: (turns, topic) => talk(turns, topic),
  play: (state, ms, fx, line) => {
    startScripted(state, ms, fx, line);
    if (line) sayNow(line);
  },
  say: (line) => sayNow(line),
  fx: (kind, ms) => scriptFx(kind, ms),
  face: (face, ms) => scriptFace(face, ms),
  walk: (dx, dy) => walker?.walkBy(dx, dy) ?? Promise.resolve(),
  action: (id) => runAction(id),
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms))
});

let loaded: ModInfo[] = [];
let problems: ModProblem[] = [];
export const modStatus = () => ({ mods: loaded, problems });
const statusListeners = new Set<() => void>();
export const onModStatus = (listener: () => void) => statusListeners.add(listener);

const context = (): ModContext => ({
  characterId: pack.id,
  timerMode: petStore.getState().timer.mode,
  musicPlaying: music.nowPlaying?.state === 'playing',
  walking: Boolean(walker?.facing()),
  hour: new Date().getHours()
});

export const reloadMods = async () => {
  const result = await api.listMods();
  loaded = result.mods;
  problems = result.problems;
  const enabled = loaded.filter((m) => m.enabled).map((m) => m.mod);
  setModStates(enabled);
  runner.load(enabled, pack.id);
  statusListeners.forEach((listener) => listener());
};

export const fireMod = (event: ModEvent) => runner.fire(event, context(), Date.now());

// Runs `before` hooks (waiting for them), the thing itself, then `after` hooks.
export const around = async (name: PetEvent, body: () => void | Promise<void>) => {
  await runner.run({ type: 'event', name, phase: 'before' }, context(), Date.now());
  await body();
  void runner.run({ type: 'event', name, phase: 'after' }, context(), Date.now());
};
export const emit = (name: PetEvent, phase: 'before' | 'after') => runner.fire({ type: 'event', name, phase }, context(), Date.now());

export const cancelMods = () => runner.cancel();
export const modMenuItems = () => runner.menuItems();

// Change detection for the timer, music and the clock, checked every frame.
let lastTimer = petStore.getState().timer.mode;
let lastMusic = false;
let lastHour = new Date().getHours();
let lastActivitySeen = pet.lastActivity;

export const modTick = () => {
  const now = Date.now();
  const { mode } = petStore.getState().timer;
  if (mode !== lastTimer) {
    if (lastTimer === 'focus') { fireMod({ type: 'timer', event: 'focusEnd' }); emit('focusEnd', 'after'); }
    if (lastTimer === 'break') { fireMod({ type: 'timer', event: 'breakEnd' }); emit('breakEnd', 'after'); }
    if (mode === 'focus') { fireMod({ type: 'timer', event: 'focusStart' }); emit('focusStart', 'after'); }
    if (mode === 'break') { fireMod({ type: 'timer', event: 'breakStart' }); emit('breakStart', 'after'); }
    lastTimer = mode;
  }
  const playing = music.nowPlaying?.state === 'playing';
  if (playing !== lastMusic) {
    fireMod({ type: 'music', playing });
    emit(playing ? 'musicStart' : 'musicStop', 'after');
    lastMusic = playing;
  }
  const hour = new Date().getHours();
  if (hour !== lastHour) {
    fireMod({ type: 'time', hour });
    lastHour = hour;
  }
  if (pet.lastActivity !== lastActivitySeen) {
    runner.resetIdle();
    lastActivitySeen = pet.lastActivity;
  }
  if (runner.isRunning() || pet.panelShown) return;
  fireMod({ type: 'idle', idleMs: now - pet.lastActivity }) || fireMod({ type: 'tick' });
};

export const startMods = async () => {
  api.onModsChanged(() => void reloadMods());
  onCharacterChange(() => {
    runner.load(loaded.filter((m) => m.enabled).map((m) => m.mod), pack.id);
    emit('characterChange', 'after');
  });
  await reloadMods();
};
