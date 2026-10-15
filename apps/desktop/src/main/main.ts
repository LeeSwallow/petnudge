import { BrowserWindow, app, dialog, globalShortcut, ipcMain, net, protocol, screen, shell } from 'electron';
import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, watch } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { isExternalPlayer, isValidMusicRef, type NowPlaying } from '../shared/music';
import { isDbMethod } from '../shared/dbMethods';
import { createRepository, type Repository } from './db/repository';
import { migrate } from './db/schema';
import { toDateKey } from '../../../mobile/src/domain/progress';
import { startMcpServer, type McpInfo } from './mcp';
import { controlPlayer, playItem, readNowPlaying } from './nowPlaying';
import { WINDOW_WIDTH, computeLayout, type Point } from './layout';
import { createCharacterLibrary } from './characters';
import { createModLibrary } from './mods';
import { createBackup, parseBackup, restoreBackup, summarizeBackup, type Backup } from './backup';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { installChat } from './chatIpc';
import { createFriends } from './friends';
import { startEngine, type EngineHandle } from '../infra/runtime';
import { bridgePower } from '../infra/electron/power';
const NOW_PLAYING_POLL_MS = 2000;

const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'flac', 'opus', 'webm'];

// pet-audio://<playlist item id> streams a file the user added to a playlist;
// the renderer never gets general file access.
protocol.registerSchemesAsPrivileged([
  { scheme: 'pet-audio', privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true } }
]);

// Same data folder for `npm start` and the installed app.
app.setName('Study Companion Pet');
app.setPath('userData', path.join(app.getPath('appData'), 'Study Companion Pet'));
// Dev (npm start) reads the built-in characters straight from assets/, so a
// re-export (npm run watch:character) reloads the pet without a rebuild.
const builtinCharacters = app.isPackaged ? path.join(__dirname, 'characters') : path.resolve(__dirname, '..', 'assets', 'characters');
const characters = createCharacterLibrary(path.join(app.getPath('userData'), 'characters'), builtinCharacters, { editBuiltinInPlace: !app.isPackaged });
// Mods: shipped ones next to the app, the user's under userData/mods.
const builtinMods = app.isPackaged ? path.join(__dirname, 'mods') : path.resolve(__dirname, '..', 'assets', 'mods');
const userMods = path.join(app.getPath('userData'), 'mods');
const disabledMods = (): string[] => {
  try { return JSON.parse(repository.getKv('mods.disabled') ?? '[]'); } catch { return []; }
};
const mods = createModLibrary(builtinMods, userMods, disabledMods);
// Pet chat + the tools it (and MCP clients) can use; see chatIpc.ts.
const chat = installChat({
  userData: app.getPath('userData'),
  repository: () => repository,
  win: () => win,
  mcp: () => mcpInfo,
  listCharacters: async () => (await characters.list()).map(({ id, name }) => ({ id, name })),
  listMods: async () => (await mods.list()).mods.map(({ mod, enabled }) => ({ id: mod.id, name: mod.name, enabled, description: mod.description })),
  setModEnabled: (id, enabled) => setModEnabled(id, enabled)
});
const insideMods = (file: unknown): file is string =>
  typeof file === 'string' && [builtinMods, userMods].some((root) => path.resolve(file).startsWith(root + path.sep));

const watchBuiltinCharacter = () => {
  const timers = new Map<string, NodeJS.Timeout>();
  watch(builtinCharacters, { recursive: true }, (_event, file) => {
    const [id, name] = String(file ?? '').split(path.sep);
    if (name !== 'character.json') return;
    clearTimeout(timers.get(id));
    timers.set(id, setTimeout(() => win?.webContents.send('characters:changed', id), 200));
  });
};

let win: BrowserWindow | null = null;
let repository: Repository;
// Raw handle for backup/restore, which works on whole tables.
let database: DatabaseSync;
// Core engine (docs/superpowers/specs/2026-10-15-study-companion-architecture-design.md).
// No modules are registered yet; stage 3 moves features onto it one by one.
let engine: EngineHandle | null = null;
let mcpInfo: McpInfo | null = null;

// Early dev builds stored data under the package name; carry it over once.
const migrateLegacyData = (file: string) => {
  const legacy = path.join(app.getPath('appData'), 'lofi-study-companion-desktop');
  if (existsSync(file) || !existsSync(path.join(legacy, 'study-companion.sqlite'))) return;
  for (const name of ['study-companion.sqlite', 'study-companion.sqlite-wal', 'study-companion.sqlite-shm', 'mcp-token.json']) {
    if (existsSync(path.join(legacy, name))) copyFileSync(path.join(legacy, name), path.join(app.getPath('userData'), name));
  }
};

const openDatabase = () => {
  mkdirSync(app.getPath('userData'), { recursive: true });
  const file = path.join(app.getPath('userData'), 'study-companion.sqlite');
  migrateLegacyData(file);
  const db = new DatabaseSync(file);
  migrate(db);
  repository = createRepository(db);
  database = db;
  // Stop the scheduler loop before the database it reads goes away.
  app.on('will-quit', () => {
    void engine?.dispose();
    db.close();
  });
};

const RESET_SHORTCUT = 'CommandOrControl+Alt+P';

// Window geometry follows the pet's feet (the anchor); see layout.ts. The
// renderer reports how big the pet area is and whether the panel is open.
const view = { anchor: { x: 0, y: 0 } as Point, petAreaHeight: 200, petWidth: 156, panelOpen: false };

const homeAnchor = (): Point => {
  const { workArea } = screen.getPrimaryDisplay();
  return { x: workArea.x + workArea.width - WINDOW_WIDTH / 2 - 16, y: workArea.y + workArea.height - 10 };
};

const savedAnchor = (): Point => {
  try {
    const saved = JSON.parse(repository.getKv('pet.anchor') ?? 'null') as Point | null;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved;
    // Older builds saved the top-left of a 380x720 window with the pet at its bottom.
    const legacy = JSON.parse(repository.getKv('window.position') ?? 'null') as Point | null;
    if (legacy && Number.isFinite(legacy.x) && Number.isFinite(legacy.y)) return { x: legacy.x + 190, y: legacy.y + 710 };
  } catch {
    // ignore corrupt value
  }
  return homeAnchor();
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;
const applyLayout = () => {
  if (!win) return;
  const { workArea } = screen.getDisplayNearestPoint(view.anchor);
  const layout = computeLayout({ ...view, workArea });
  view.anchor = layout.anchor;
  win.setBounds(layout.bounds);
  win.webContents.send('layout', { below: layout.below, petDx: layout.petDx, panelHeight: layout.panelHeight });
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => repository.setKv('pet.anchor', JSON.stringify(view.anchor)), 400);
};

const resetPosition = () => {
  view.anchor = homeAnchor();
  applyLayout();
  win?.showInactive();
};

const createWindow = () => {
  view.anchor = savedAnchor();
  const { workArea } = screen.getDisplayNearestPoint(view.anchor);
  const { bounds } = computeLayout({ ...view, workArea });
  win = new BrowserWindow({
    ...bounds,
    transparent: true,
    frame: false,
    resizable: false,
    hasShadow: false,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true
    }
  });
  applyAlwaysOnTop(repository.getSettings().alwaysOnTop);
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Transparent pixels pass clicks through to the desktop; the renderer
  // turns this off while the cursor is over the pet or its panel.
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // A (re)loaded renderer starts with the panel closed.
  win.webContents.on('did-finish-load', () => {
    view.panelOpen = false;
    applyLayout();
  });
};

const applyAlwaysOnTop = (enabled: boolean) => win?.setAlwaysOnTop(enabled, 'floating');

const pollNowPlaying = () => {
  let last = '';
  setInterval(async () => {
    const nowPlaying: NowPlaying | null = await readNowPlaying();
    const serialized = JSON.stringify(nowPlaying);
    if (serialized === last) return;
    last = serialized;
    win?.webContents.send('now-playing', nowPlaying);
  }, NOW_PLAYING_POLL_MS);
};

// Every repository method validates its own arguments, so the renderer may
// call any listed one by name — but nothing else.
ipcMain.handle('db', (_event, method: unknown, ...args: unknown[]) => {
  if (!isDbMethod(method)) throw new Error(`unknown db method ${String(method)}`);
  const fn = repository[method] as (...a: unknown[]) => unknown;
  const result = fn(...args);
  if (method === 'updateSettings') applyAlwaysOnTop(repository.getSettings().alwaysOnTop);
  return result;
});

// Friend pet windows send the same window messages; they go to friends.ts.
ipcMain.on('set-ignore-mouse', (event, ignore: unknown) => {
  const target = friends.byContents(event.sender)?.win ?? win;
  target?.setIgnoreMouseEvents(ignore === true, { forward: true });
});

ipcMain.on('move-by', (event, dx: unknown, dy: unknown) => {
  if (typeof dx !== 'number' || typeof dy !== 'number') return;
  const friend = friends.byContents(event.sender);
  if (friend) return friends.moveBy(friend, dx, dy);
  view.anchor = { x: view.anchor.x + dx, y: view.anchor.y + dy };
  applyLayout();
});

// One walking step (whole px, any direction); returns the room left to each
// edge of the work area, matching clampAnchor's limits.
const step = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(-20, Math.min(20, Math.round(v))) : 0);
ipcMain.handle('walk-step', (event, dx: unknown, dy: unknown) => {
  const [sx, sy] = [step(dx), step(dy)];
  const friend = friends.byContents(event.sender);
  if (friend) {
    if (sx || sy) friends.moveBy(friend, sx, sy);
    const room = friends.room(friend);
    return { left: Math.max(0, room.left), right: Math.max(0, room.right), up: Math.max(0, room.up), down: Math.max(0, room.down - 10) };
  }
  if ((sx || sy) && !view.panelOpen) {
    view.anchor = { x: view.anchor.x + sx, y: view.anchor.y + sy };
    applyLayout();
  }
  const { workArea: wa } = screen.getDisplayNearestPoint(view.anchor);
  return {
    left: Math.max(0, view.anchor.x - (wa.x + view.petWidth / 2)),
    right: Math.max(0, wa.x + wa.width - view.petWidth / 2 - view.anchor.x),
    up: Math.max(0, view.anchor.y - (wa.y + view.petAreaHeight)),
    down: Math.max(0, wa.y + wa.height - 10 - view.anchor.y)
  };
});

ipcMain.on('pet-layout', (event, size: unknown) => {
  const { petAreaHeight, petWidth } = (size ?? {}) as Record<string, unknown>;
  if (typeof petAreaHeight !== 'number' || typeof petWidth !== 'number') return;
  const friend = friends.byContents(event.sender);
  if (friend) return friends.setLayout(friend, petAreaHeight, petWidth);
  view.petAreaHeight = Math.max(40, Math.min(800, Math.round(petAreaHeight)));
  view.petWidth = Math.max(20, Math.min(WINDOW_WIDTH, Math.round(petWidth)));
  applyLayout();
});

ipcMain.on('panel-open', (_event, open: unknown) => {
  view.panelOpen = open === true;
  applyLayout();
});

ipcMain.on('reset-position', resetPosition);

// ---------- friend pets ----------
const friends = createFriends({
  page: path.join(__dirname, 'renderer', 'index.html'),
  preload: path.join(__dirname, 'preload.js'),
  alwaysOnTop: () => repository.getSettings().alwaysOnTop,
  mainAnchor: () => view.anchor,
  mainContents: () => win?.webContents,
  onListChange: (ids) => {
    repository.setKv('friends.out', JSON.stringify(ids));
    win?.webContents.send('friends:list', ids);
  }
});
ipcMain.handle('friends:list', () => friends.list());
ipcMain.handle('friends:open', async (_event, id: unknown) => {
  if (typeof id !== 'string' || !(await characters.list()).some((c) => c.id === id)) throw new Error('없는 캐릭터예요');
  friends.open(id);
});
ipcMain.on('friends:close', (event, id: unknown) => {
  const self = friends.byContents(event.sender);
  if (self) return self.win.close(); // a friend closing itself
  if (typeof id === 'string') friends.close(id);
});
ipcMain.on('friends:say', (_event, id: unknown, text: unknown, ms: unknown) => {
  if (typeof id === 'string' && typeof text === 'string') friends.say(id, text.slice(0, 300), typeof ms === 'number' ? ms : 6000);
});
ipcMain.on('friends:hold', (_event, id: unknown, ms: unknown, faceDx: unknown) => {
  if (typeof id === 'string' && typeof ms === 'number') friends.hold(id, Math.min(ms, 300_000), typeof faceDx === 'number' ? faceDx : 0);
});

// Cursor position relative to the window, for the pet's eyes to follow.
ipcMain.handle('cursor', (event) => {
  const friend = friends.byContents(event.sender);
  if (friend) return friends.cursor(friend);
  if (!win) return null;
  const cursor = screen.getCursorScreenPoint();
  const [x, y] = win.getPosition();
  return { x: cursor.x - x, y: cursor.y - y };
});

ipcMain.handle('music-control', async (_event, player: unknown, action: unknown) => {
  if (!isExternalPlayer(player) || (action !== 'play' && action !== 'pause' && action !== 'next')) return;
  await controlPlayer(player, action);
});

ipcMain.handle('music-play-item', async (_event, player: unknown, ref: unknown) => {
  if (!isExternalPlayer(player) || typeof ref !== 'string') return;
  await playItem(player, ref);
});

// Native file picker for adding audio files to a playlist.
ipcMain.handle('pick-audio-files', async () => {
  if (!win) return [];
  const result = await dialog.showOpenDialog(win, {
    title: '플레이리스트에 추가할 음악',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: '오디오', extensions: AUDIO_EXTENSIONS }]
  });
  return result.canceled ? [] : result.filePaths.filter((file) => isValidMusicRef('Local', file));
});

const serveAudio = () =>
  protocol.handle('pet-audio', (request) => {
    const item = repository.getPlaylistItem(new URL(request.url).hostname);
    if (!item || item.player !== 'Local' || !isValidMusicRef('Local', item.ref)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(item.ref).toString(), { headers: request.headers });
  });

ipcMain.handle('mcp-info', () => mcpInfo);

// Data backup (Settings → 데이터 백업). Main owns the file dialogs; an import
// is validated first and held here until the renderer confirms it.
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;
let pendingImport: Backup | null = null;
ipcMain.handle('data:export', async () => {
  if (!win) return null;
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: '데이터 내보내기',
    defaultPath: path.join(app.getPath('documents'), `study-pet-backup-${toDateKey(new Date())}.json`),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return null;
  const backup = createBackup(database, app.getVersion());
  await writeFile(filePath, JSON.stringify(backup, null, 2), 'utf8');
  return { file: path.basename(filePath), ...summarizeBackup(backup) };
});
ipcMain.handle('data:import', async (_event, step: unknown) => {
  if (step === 'cancel') {
    pendingImport = null;
    return null;
  }
  if (step === 'apply') {
    if (!pendingImport) throw new Error('가져올 파일을 먼저 골라주세요');
    const session = restoreBackup(database, pendingImport);
    pendingImport = null;
    applyAlwaysOnTop(repository.getSettings().alwaysOnTop);
    for (const kind of ['todos', 'notes', 'stats'] as const) win?.webContents.send('data-changed', kind);
    return { session };
  }
  if (!win) return null;
  pendingImport = null;
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: '백업 파일 가져오기',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePaths[0]) return null;
  if ((await stat(filePaths[0])).size > MAX_BACKUP_BYTES) throw new Error('파일이 너무 커요 (100MB 이하만 가져올 수 있어요)');
  const backup = parseBackup(await readFile(filePaths[0], 'utf8'));
  pendingImport = backup;
  return { file: path.basename(filePaths[0]), ...summarizeBackup(backup) };
});
ipcMain.handle('mods:list', () => mods.list());
ipcMain.handle('mods:create', async () => {
  const file = await mods.create();
  shell.showItemInFolder(file);
  win?.webContents.send('mods:changed');
  return file;
});
ipcMain.handle('mods:open', async (_event, file: unknown) => {
  if (!insideMods(file)) throw new Error('모드 폴더 밖의 파일은 열 수 없어요');
  const error = await shell.openPath(file);
  if (error) shell.showItemInFolder(file);
});
const setModEnabled = (id: string, enabled: boolean) => {
  const next = new Set(disabledMods());
  if (enabled) next.delete(id); else next.add(id);
  repository.setKv('mods.disabled', JSON.stringify([...next]));
  win?.webContents.send('mods:changed');
};
ipcMain.handle('mods:toggle', (_event, id: unknown, enabled: unknown) => {
  if (typeof id !== 'string' || typeof enabled !== 'boolean') return;
  setModEnabled(id, enabled);
});
ipcMain.handle('characters:list', () => characters.list());
ipcMain.handle('characters:get', (_event, id: unknown) => characters.load(id));
ipcMain.handle('characters:import', async () => {
  if (!win) return null;
  const selected = await dialog.showOpenDialog(win, { title: '캐릭터 팩 폴더 가져오기', properties: ['openDirectory'] });
  return selected.canceled ? null : characters.importFolder(selected.filePaths[0]);
});
// Pixelorama doesn't register .pxo with the OS, so it is opened by name on
// macOS (PIXELORAMA=/path/to/Pixelorama.app overrides); .aseprite opens in
// whatever the system uses for it.
const openInEditor = async (file: string) => {
  if (file.endsWith('.pxo') && process.platform === 'darwin') {
    const target = process.env.PIXELORAMA ?? (existsSync('/Applications/Pixelorama.app') ? '/Applications/Pixelorama.app' : path.join(app.getPath('home'), 'Applications', 'Pixelorama.app'));
    if (!existsSync(target)) throw new Error('Pixelorama를 찾지 못했어요. 응용 프로그램 폴더에 설치해주세요');
    await new Promise<void>((resolve, reject) => execFile('open', ['-a', target, file], (error) => (error ? reject(error) : resolve())));
    return;
  }
  const error = await shell.openPath(file);
  if (error) throw new Error(error);
};
// After "원본 편집" the app watches that source and its pack and rebuilds on
// every save, so no terminal is needed; failures go to Settings.
const editing = new Map<string, () => void>();
const watchEdits = (id: string, files: { source: string; manifest: string }) => {
  if (editing.has(id)) return;
  let timer: NodeJS.Timeout | undefined;
  const names = new Set([path.basename(files.source), path.basename(files.manifest)]);
  const dirs = new Set([path.dirname(files.source), path.dirname(files.manifest)]);
  const watchers = [...dirs].map((dir) => watch(dir, (_event, file) => {
    if (!file || !names.has(String(file))) return;
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        await characters.rebuild(id);
        win?.webContents.send('characters:changed', id);
      } catch (error) {
        win?.webContents.send('characters:error', id, error instanceof Error ? error.message : String(error));
      }
    }, 400);
  }));
  editing.set(id, () => watchers.forEach((w) => w.close()));
};
ipcMain.handle('characters:edit', async (_event, id: unknown) => {
  const files = await characters.prepareSource(id);
  watchEdits(String(id), files);
  await openInEditor(files.source);
});
ipcMain.handle('characters:clone', (_event, from: unknown, name: unknown) => characters.clone(from, name));
ipcMain.handle('characters:rebuild', (_event, id: unknown) => characters.rebuild(id));

ipcMain.on('quit', () => app.quit());

const startMcp = async () => {
  try {
    mcpInfo = await startMcpServer(app.getPath('userData'), repository, chat.bridge);
  } catch (error) {
    console.error('MCP server failed to start', error);
  }
};

app.whenReady().then(() => {
  openDatabase();
  void startEngine(database, [])
    .then((handle) => {
      engine = handle;
      bridgePower((reason) => void handle.wake(reason));
    })
    .catch((error) => console.error('engine failed to start', error));
  serveAudio();
  createWindow();
  if (!app.isPackaged) watchBuiltinCharacter();
  mods.watchUser(() => win?.webContents.send('mods:changed'));
  globalShortcut.register(RESET_SHORTCUT, resetPosition);
  // Monitors added/removed/rearranged: pull the pet back on screen.
  screen.on('display-removed', applyLayout);
  screen.on('display-metrics-changed', applyLayout);
  pollNowPlaying();
  void startMcp();
  friends.watchProximity();
  // Friends who were out last time come back.
  win?.webContents.once('did-finish-load', () => {
    try { for (const id of JSON.parse(repository.getKv('friends.out') ?? '[]')) friends.open(String(id)); } catch { /* none */ }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  chat.cancelAll();
});
app.on('window-all-closed', () => app.quit());
