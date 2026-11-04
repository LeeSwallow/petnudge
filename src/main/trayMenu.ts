// What the tray (macOS menu bar) menu holds, apart from Electron so it can be
// tested; tray.ts turns it into a Menu. Every action with a shortcut is here
// too, so nothing needs the keys (spec 2026-11-04, "펫 곁 상호작용").

export const RESET_SHORTCUT = 'CommandOrControl+Alt+P';
// Paired with the reset key; registered only while settings.chatShortcut is on.
export const CHAT_SHORTCUT = 'CommandOrControl+Alt+C';

export type TrayAction = 'panel' | 'chat' | 'reset' | 'quit';

export type TrayItem =
  | { type: 'item'; action: TrayAction; label: string; accelerator?: string }
  | { type: 'separator' };

export const trayMenuItems = (state: { panelOpen: boolean; chatShortcut: boolean }): TrayItem[] => [
  { type: 'item', action: 'panel', label: state.panelOpen ? '패널 닫기' : '패널 열기' },
  state.chatShortcut ? { type: 'item', action: 'chat', label: '말 걸기', accelerator: CHAT_SHORTCUT } : { type: 'item', action: 'chat', label: '말 걸기' },
  { type: 'item', action: 'reset', label: '위치 초기화', accelerator: RESET_SHORTCUT },
  { type: 'separator' },
  { type: 'item', action: 'quit', label: '나가기' }
];
