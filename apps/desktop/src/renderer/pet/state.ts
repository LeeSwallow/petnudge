import { pack } from '../character';
import { pickLine } from '../character/actions';
import type { Reaction } from '../sprite';
import { petStore } from '../store';

// What the pet is doing right now, shared by the bubble, input, behaviour and
// drawing modules.

const SLEEP_AFTER_MS = 5 * 60_000;

// `state`/`fx` set directly by scripts (mod `play` blocks); `action` by pack actions.
export type ReactionState = { kind: Reaction; startedAt: number; until: number; action?: string; line?: string; state?: string; fx?: string };

export const pet = {
  frame: 0,
  reaction: { kind: 'none', startedAt: 0, until: 0 } as ReactionState,
  panelShown: false,
  lastActivity: Date.now(),
  lastLine: undefined as string | undefined,
  // Script overlays: an expression and an effect, each until a time.
  face: null as { face: string; until: number } | null,
  fx: null as { kind: string; startedAt: number; until: number } | null
};

// A script plays a state for `ms` (with an optional effect and line).
export const startScripted = (state: string, ms: number, fx?: string, line?: string) => {
  pet.reaction = { kind: 'action', startedAt: pet.frame, until: Date.now() + ms, state, fx, line };
  markActivity();
};
export const scriptFace = (face: string, ms: number) => {
  pet.face = { face, until: Date.now() + ms };
};
export const scriptFx = (kind: string, ms: number) => {
  pet.fx = { kind, startedAt: pet.frame, until: Date.now() + ms };
};

export const markActivity = () => {
  pet.lastActivity = Date.now();
};

export const react = (kind: Reaction, ms: number) => {
  pet.reaction = { kind, startedAt: pet.frame, until: Date.now() + ms };
};

// Starts a pack action (pat, poke, flick, emotes…); returns false if unknown.
export const startAction = (id: string) => {
  const action = pack.actions?.[id];
  if (!action) return false;
  const line = pickLine(action.lines, pet.lastLine);
  pet.lastLine = line ?? pet.lastLine;
  pet.reaction = { kind: 'action', startedAt: pet.frame, until: Date.now() + action.ms, action: id, line };
  markActivity();
  return true;
};

export const activeAction = () => (pet.reaction.kind === 'action' && Date.now() < pet.reaction.until ? pet.reaction : null);

export const currentReaction = (): Reaction => {
  const { reaction } = pet;
  if (reaction.kind !== 'none' && Date.now() < reaction.until) return reaction.kind;
  if (petStore.getState().timer.mode === 'idle' && Date.now() - pet.lastActivity > SLEEP_AFTER_MS) return 'sleepy';
  return 'none';
};

export const isDragging = () => pet.reaction.kind === 'dragged' && Date.now() < pet.reaction.until;
