import { BrowserWindow } from 'electron';

// The character editor (#26): one ordinary framed window, not on top of
// everything like the pet. Opening it again brings the open one forward.
// Its page has the pet window's CSP and its own preload (editorApi only).

export type EditorWindow = {
  // Opens the window, or focuses it when it is already open.
  open(): BrowserWindow;
  close(): void;
  // The open window, if any.
  current(): BrowserWindow | null;
};

export const EDITOR_SIZE = { width: 960, height: 640, minWidth: 720, minHeight: 480 } as const;

// `testHooks`: open the page with ?test=1, which turns on the editor check's
// hooks (src/ui/editor/testHooks.ts).
export const createEditorWindow = ({ page, preload, testHooks = false }: { page: string; preload: string; testHooks?: boolean }): EditorWindow => {
  let win: BrowserWindow | null = null;
  const current = () => (win && !win.isDestroyed() ? win : null);
  const open = () => {
    const existing = current();
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.show();
      existing.focus();
      return existing;
    }
    const created = new BrowserWindow({
      ...EDITOR_SIZE,
      title: '캐릭터 에디터',
      backgroundColor: '#2a1d33', // --color-panel, so no white flash before the page paints
      show: false,
      webPreferences: { preload, contextIsolation: true, sandbox: true }
    });
    win = created;
    created.once('ready-to-show', () => created.show());
    created.on('closed', () => {
      if (win === created) win = null;
    });
    // The editor never navigates or opens windows of its own.
    created.webContents.on('will-navigate', (event) => event.preventDefault());
    created.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    void created.loadFile(page, testHooks ? { query: { test: '1' } } : undefined);
    return created;
  };
  return { open, close: () => current()?.close(), current };
};
