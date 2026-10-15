import { BrowserWindow, app, screen, type WebContents } from 'electron';
import { computeLayout, type Point } from './layout';

// Friend pets: other characters out on the desktop in their own small
// windows (the same page in friend mode, ?friend=<id>). They wander like
// the main pet; this module also measures how close each one is to the main
// pet and tells both sides, which drives the friend events (mods) and the
// meetup chats.

export const NEAR_X = 240; // px between feet, sideways
export const NEAR_Y = 140;

type Friend = { id: string; win: BrowserWindow; view: { anchor: Point; petAreaHeight: number; petWidth: number; panelOpen: false }; near: boolean; nearSince: number };

type Deps = {
  page: string;
  preload: string;
  alwaysOnTop: () => boolean;
  mainAnchor: () => Point;
  mainContents: () => WebContents | undefined;
  onListChange: (ids: string[]) => void;
};

export const createFriends = (deps: Deps) => {
  const friends = new Map<string, Friend>();
  // Quitting closes every window; that shouldn't forget who was out.
  let quitting = false;
  app.on('before-quit', () => { quitting = true; });

  const layout = (friend: Friend) => {
    const { workArea } = screen.getDisplayNearestPoint(friend.view.anchor);
    const result = computeLayout({ ...friend.view, workArea });
    friend.view.anchor = result.anchor;
    friend.win.setBounds(result.bounds);
    friend.win.webContents.send('layout', { below: false, petDx: result.petDx, panelHeight: 0 });
  };

  const open = (id: string) => {
    if (friends.has(id)) return;
    const main = deps.mainAnchor();
    const { workArea } = screen.getDisplayNearestPoint(main);
    // Appears a little to the side of the main pet, inside the screen.
    const side = main.x - workArea.x > workArea.width / 2 ? -1 : 1;
    const view = { anchor: { x: main.x + side * (NEAR_X + 60), y: main.y }, petAreaHeight: 200, petWidth: 156, panelOpen: false as const };
    const bounds = computeLayout({ ...view, workArea }).bounds;
    const win = new BrowserWindow({
      ...bounds, transparent: true, frame: false, resizable: false, hasShadow: false, skipTaskbar: true, show: false,
      webPreferences: { preload: deps.preload, contextIsolation: true, sandbox: true }
    });
    win.setAlwaysOnTop(deps.alwaysOnTop(), 'floating');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true, { forward: true });
    win.loadFile(deps.page, { query: { friend: id } });
    const friend: Friend = { id, win, view, near: false, nearSince: 0 };
    friends.set(id, friend);
    win.once('ready-to-show', () => win.showInactive());
    win.webContents.on('did-finish-load', () => layout(friend));
    win.on('closed', () => {
      friends.delete(id);
      if (!quitting) deps.onListChange(list());
    });
    deps.onListChange(list());
  };

  const close = (id: string) => friends.get(id)?.win.close();
  const closeAll = () => friends.forEach((f) => f.win.close());
  const list = () => [...friends.keys()];
  const byContents = (contents: WebContents) => [...friends.values()].find((f) => f.win.webContents === contents);

  const moveBy = (friend: Friend, dx: number, dy: number) => {
    friend.view.anchor = { x: friend.view.anchor.x + dx, y: friend.view.anchor.y + dy };
    layout(friend);
  };

  const room = (friend: Friend) => {
    const { workArea: wa } = screen.getDisplayNearestPoint(friend.view.anchor);
    const half = friend.view.petWidth / 2;
    return {
      left: friend.view.anchor.x - half - wa.x, right: wa.x + wa.width - (friend.view.anchor.x + half),
      up: friend.view.anchor.y - friend.view.petAreaHeight - wa.y, down: wa.y + wa.height - friend.view.anchor.y
    };
  };

  const setLayout = (friend: Friend, petAreaHeight: number, petWidth: number) => {
    friend.view.petAreaHeight = Math.max(40, Math.min(800, Math.round(petAreaHeight)));
    friend.view.petWidth = Math.max(20, Math.min(380, Math.round(petWidth)));
    layout(friend);
  };

  const cursor = (friend: Friend) => {
    const point = screen.getCursorScreenPoint();
    const [x, y] = friend.win.getPosition();
    return { x: point.x - x, y: point.y - y };
  };

  const say = (id: string, text: string, ms: number) => friends.get(id)?.win.webContents.send('friend-say', text, ms);
  const hold = (id: string, ms: number, faceDx: number) => friends.get(id)?.win.webContents.send('friend-hold', ms, faceDx);

  // How far each friend is from the main pet, every few hundred ms.
  const watchProximity = () => setInterval(() => {
    const main = deps.mainAnchor();
    for (const friend of friends.values()) {
      const dx = friend.view.anchor.x - main.x;
      const dy = friend.view.anchor.y - main.y;
      const near = Math.abs(dx) < NEAR_X && Math.abs(dy) < NEAR_Y;
      if (near !== friend.near) {
        friend.near = near;
        friend.nearSince = near ? Date.now() : 0;
      }
      // Both sides hear it: the main pet about the friend, the friend about her.
      deps.mainContents()?.send('friend-near', { id: friend.id, near, dx, since: friend.nearSince });
      friend.win.webContents.send('friend-near', { id: 'main', near, dx: -dx, since: friend.nearSince });
    }
  }, 500);

  return { open, close, closeAll, list, byContents, moveBy, room, setLayout, cursor, say, hold, watchProximity, layout };
};

export type Friends = ReturnType<typeof createFriends>;
