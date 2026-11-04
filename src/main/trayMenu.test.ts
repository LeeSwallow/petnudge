import { describe, expect, it } from 'vitest';
import { CHAT_SHORTCUT, RESET_SHORTCUT, trayMenuItems } from './trayMenu';

const actions = (items: ReturnType<typeof trayMenuItems>) => items.map((item) => (item.type === 'separator' ? '---' : item.action));

describe('trayMenuItems', () => {
  it('lists open panel, talk, reset position and quit, quit set apart', () => {
    expect(actions(trayMenuItems({ panelOpen: false, chatShortcut: false }))).toEqual(['panel', 'chat', 'reset', '---', 'quit']);
  });

  it('labels the panel item by what pressing it will do', () => {
    const label = (panelOpen: boolean) => trayMenuItems({ panelOpen, chatShortcut: false }).find((i) => i.type !== 'separator' && i.action === 'panel');
    expect(label(false)).toMatchObject({ label: '패널 열기' });
    expect(label(true)).toMatchObject({ label: '패널 닫기' });
  });

  it('shows the reset key always and the chat key only while the chat shortcut is on', () => {
    const find = (chatShortcut: boolean, action: string) =>
      trayMenuItems({ panelOpen: false, chatShortcut }).find((i) => i.type !== 'separator' && i.action === action);
    expect(find(false, 'reset')).toMatchObject({ label: '위치 초기화', accelerator: RESET_SHORTCUT });
    expect(find(false, 'chat')).toEqual({ type: 'item', action: 'chat', label: '말 걸기' });
    expect(find(true, 'chat')).toMatchObject({ label: '말 걸기', accelerator: CHAT_SHORTCUT });
    expect(find(true, 'quit')).toEqual({ type: 'item', action: 'quit', label: '나가기' });
  });

  it('pairs the chat key with the reset key', () => {
    expect(RESET_SHORTCUT).toBe('CommandOrControl+Alt+P');
    expect(CHAT_SHORTCUT).toBe('CommandOrControl+Alt+C');
  });
});
