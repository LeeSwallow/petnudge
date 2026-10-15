import { describe, expect, it } from 'vitest';
import { PANEL_HEIGHT, WINDOW_WIDTH, computeLayout, type LayoutInput } from './layout';

const workArea = { x: 0, y: 25, width: 1440, height: 875 }; // below a 25px menu bar
const input = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  anchor: { x: 700, y: 800 },
  workArea,
  petAreaHeight: 200,
  petWidth: 156,
  panelOpen: false,
  ...over
});

describe('computeLayout', () => {
  it('shrinks the window to the pet area while the panel is closed', () => {
    const { bounds, below } = computeLayout(input());
    expect(bounds).toEqual({ x: 700 - WINDOW_WIDTH / 2, y: 800 + 10 - 220, width: WINDOW_WIDTH, height: 220 });
    expect(below).toBe(false);
  });

  it('lets the pet reach right under the menu bar', () => {
    const { anchor, bounds } = computeLayout(input({ anchor: { x: 700, y: 0 } }));
    expect(bounds.y).toBe(workArea.y - 10);
    expect(anchor.y).toBe(workArea.y + 200);
  });

  it('opens the panel above when there is room', () => {
    const { bounds, below, panelHeight } = computeLayout(input({ panelOpen: true }));
    expect(below).toBe(false);
    expect(panelHeight).toBe(PANEL_HEIGHT);
    expect(bounds.y + bounds.height).toBe(810); // pet stays put
  });

  it('opens the panel below when the pet is near the top', () => {
    const { bounds, below, panelHeight } = computeLayout(input({ anchor: { x: 700, y: 300 }, panelOpen: true }));
    expect(below).toBe(true);
    expect(panelHeight).toBe(PANEL_HEIGHT);
    expect(bounds.y).toBe(300 + 10 - 220); // pet area stays on top, where it was
  });

  it('shrinks the panel to the larger side when neither fits', () => {
    const small = { x: 0, y: 0, width: 800, height: 700 };
    const { below, panelHeight, bounds } = computeLayout(input({ workArea: small, anchor: { x: 400, y: 500 }, panelOpen: true }));
    expect(below).toBe(false); // 284px above vs 184px below
    expect(panelHeight).toBe(500 + 10 - 220 - 6);
    expect(bounds.y).toBe(0);
  });

  it('keeps the window on screen and shifts the pet inside it at the edges', () => {
    const { bounds, petDx } = computeLayout(input({ anchor: { x: 1430, y: 800 } }));
    expect(bounds.x).toBe(1440 - WINDOW_WIDTH);
    expect(petDx).toBe(1440 - 78 - (1440 - WINDOW_WIDTH / 2));
  });
});
