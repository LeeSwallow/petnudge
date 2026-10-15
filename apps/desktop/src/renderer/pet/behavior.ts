import { pack } from '../character';
import { createEmoter } from '../character/emoter';
import { data } from '../data';
import { petStore } from '../store';
import { startWalking } from '../walking';
import { renderBubble } from './bubble';
import { gaze } from './gaze';
import { currentReaction, pet, startAction } from './state';
import { around, connectMods, emit } from './mods';

// What she does on her own: wander around and emote now and then, only when
// nothing else is going on and you're not in a focus session.

const idle = () => currentReaction() === 'none' && !pet.panelShown && petStore.getState().timer.mode !== 'focus';

// Standing still for a while (talking with a friend).
let holdUntil = 0;
export const holdStill = (ms: number) => {
  holdUntil = Date.now() + ms;
};

const freeToWalk = () =>
  Date.now() >= holdUntil && idle() && data.settings.walkAround && !data.settings.reduceMotion && Boolean(pack.states.walkL && pack.states.walkR);

let walking: ReturnType<typeof startWalking> | null = null;
const emoter = createEmoter();

// Plays a pack action and shows its line (mods can hook before/after it).
export const runAction = (id: string) => {
  if (!pack.actions?.[id]) return;
  void around('action', () => {
    if (startAction(id)) renderBubble(pet.panelShown);
  });
};

export const walkFacing = () => walking?.facing() ?? 0;

export const startBehaviors = () => {
  walking = startWalking(freeToWalk);
  connectMods(walking, runAction);
  // Walk events for mods (not waited on: wandering never pauses for a hook).
  let wasWalking = false;
  setInterval(() => {
    const now = walkFacing() !== 0;
    if (now !== wasWalking) emit('walk', now ? 'before' : 'after');
    wasWalking = now;
  }, 100);
  // For DevTools: make her walk somewhere (px).
  (window as unknown as { petWalk: unknown }).petWalk = (dx: number, dy = 0) => walking?.walkBy(dx, dy);
  // For DevTools: why she is (not) walking.
  (window as unknown as { petDebug: unknown }).petDebug = () => ({
    free: freeToWalk(), facing: walkFacing(), panelShown: pet.panelShown, reaction: currentReaction(),
    timer: petStore.getState().timer.mode, hasWalk: Boolean(pack.states.walkL), pack: pack.id,
    gaze: { ...gaze }, follow: data.settings.eyesFollowCursor
  });
};

// Called every animation frame.
export const behaviorTick = () => {
  const id = emoter.tick(Date.now(), idle() && !walkFacing(), pack.emotes);
  if (id) void around('emote', () => runAction(id));
};
