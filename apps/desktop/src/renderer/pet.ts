import { pack } from './character';
import { data } from './data';
import { music } from './music';
import { behaviorTick, startBehaviors, walkFacing } from './pet/behavior';
import { isTalking } from './pet/bubble';
import { gaze, updateGaze } from './pet/gaze';
import { installPetInput as install } from './pet/input';
import { currentReaction, pet } from './pet/state';
import { GRID_HEIGHT, GRID_WIDTH, drawPet, pixelSize, syncSceneSize } from './sprite';
import { avatarFor } from '../shared/settings';
import { petStore } from './store';
import type { Fx } from './character/actions';
import { modTick, startMods } from './pet/mods';

// The pet canvas: the animation loop and drawing. The rest lives in pet/:
//   state.ts    what she is doing (reactions, activity, panel)
//   bubble.ts   the speech bubble
//   gaze.ts     following the cursor
//   input.ts    tap, drag, menu
//   behavior.ts wandering, emotes, actions

export { renderBubble } from './pet/bubble';
export { runAction } from './pet/behavior';
export { isDragging, markActivity, react } from './pet/state';

const ANIMATION_MS = 125; // 8 fps for the pet, per pixel-art convention

const canvas = document.getElementById('pet') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

export const installPetInput = (onClick: () => void) => install(canvas, onClick);

export const resizePet = () => {
  syncSceneSize();
  const size = pixelSize(data.settings.petScale);
  const dpr = window.devicePixelRatio || 1;
  canvas.width = GRID_WIDTH * size;
  canvas.height = GRID_HEIGHT * size;
  canvas.style.width = `${canvas.width / dpr}px`;
  canvas.style.height = `${canvas.height / dpr}px`;
};

const draw = () => {
  const kind = currentReaction();
  const { reaction } = pet;
  const packAction = kind === 'action' && reaction.action ? pack.actions?.[reaction.action] : undefined;
  const action = packAction ? { state: packAction.state, fx: packAction.fx } : kind === 'action' && reaction.state ? { state: reaction.state, fx: reaction.fx as Fx | undefined } : undefined;
  const now = Date.now();
  drawPet(ctx, {
    animation: petStore.getState().scene.characterAnimation,
    frame: pet.frame,
    scale: pixelSize(data.settings.petScale),
    turn: gaze.turn,
    tilt: gaze.tilt,
    avatar: avatarFor(pack, data.settings),
    musicPlaying: music.nowPlaying?.state === 'playing',
    reaction: kind,
    reactionFrame: pet.frame - reaction.startedAt,
    action,
    now,
    talking: isTalking(),
    walk: walkFacing(),
    face: pet.face && now < pet.face.until ? pet.face.face : undefined,
    fx: pet.fx && now < pet.fx.until ? { kind: pet.fx.kind as Fx, t: pet.frame - pet.fx.startedAt } : undefined
  });
};

export const startPetLoop = () => {
  startBehaviors();
  void startMods();
  resizePet();
  draw();
  setInterval(() => {
    pet.frame += 1;
    if (pet.frame % 2 === 0) void updateGaze(canvas);
    behaviorTick();
    modTick();
    draw();
  }, ANIMATION_MS);
};
