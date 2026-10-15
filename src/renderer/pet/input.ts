import { api } from '../api';
import { layerAt, pack } from '../character';
import { actionForArea, areaAt } from '../character/actions';
import { GRID_HEIGHT, GRID_WIDTH, ORIGIN_X, ORIGIN_Y } from '../sprite';
import { runAction } from './behavior';
import { markActivity, react } from './state';
import { around, cancelMods, emit, fireMod } from './mods';

// Left: tap a body part (its action, else a heart) or drag her around.
// Right / ContextMenu: toggle the panel. Enter / Space: the tap action.

// Frame pixel under a pointer event (the sprite is drawn at ORIGIN in grid pixels).
const areaUnder = (canvas: HTMLCanvasElement, event: MouseEvent) => {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * GRID_WIDTH - ORIGIN_X;
  const y = ((event.clientY - rect.top) / rect.height) * GRID_HEIGHT - ORIGIN_Y;
  return areaAt(pack, Math.floor(x), Math.floor(y), layerAt);
};

export const installPetInput = (canvas: HTMLCanvasElement, onClick: () => void) => {
  let dragStart: { x: number; y: number } | null = null;
  let last = { x: 0, y: 0 };
  let dragging = false;
  canvas.addEventListener('keydown', (event) => {
    if (event.key === 'ContextMenu' || event.key === 'F10' && event.shiftKey) {
      event.preventDefault();
      onClick();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const action = Object.entries(pack.actions ?? {}).find(([, def]) => def.tap)?.[0];
      if (action) runAction(action); else react('heart', 900);
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    dragStart = { x: event.screenX, y: event.screenY };
    last = { ...dragStart };
    dragging = false;
    markActivity();
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragStart) return;
    if (!dragging && Math.hypot(event.screenX - dragStart.x, event.screenY - dragStart.y) > 4) {
      dragging = true;
      cancelMods();
      emit('drag', 'before');
      fireMod({ type: 'drag', phase: 'start' });
      react('dragged', 60_000);
    }
    if (!dragging) return;
    api.moveBy(event.screenX - last.x, event.screenY - last.y);
    last = { x: event.screenX, y: event.screenY };
  });

  canvas.addEventListener('pointerup', (event) => {
    if (!dragStart) return;
    dragStart = null;
    if (dragging) {
      react('none', 0);
      emit('drag', 'after');
      fireMod({ type: 'drag', phase: 'end' });
      return;
    }
    // A mod's tap behaviour wins over the pack's tap action.
    const area = areaUnder(canvas, event);
    void around('tap', () => {
      if (fireMod({ type: 'tap', area })) return;
      const tapped = actionForArea(pack, area);
      if (tapped) runAction(tapped);
      else react('heart', 900);
    });
  });

  // The menu always opens, even when clicking a character hit area.
  canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    onClick();
  });

  document.addEventListener('mousemove', markActivity);
};
