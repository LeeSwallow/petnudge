import { api } from '../../renderer/api';
import { logError } from '../log';
import { WIDGETS } from '../widgets/registry';
import { DOCK_KEY, parseDock, serializeDock } from './logic';

// What the dock beside the pet follows: its widget list (shared with the home
// board's "보드에 / 도크에 / 둘 다" menu) and where she stands in the window.
// renderer.ts sets the rest through mount.ts.
export const dock = $state({
  // null until the saved list is read, so the default never flashes over it
  list: null as string[] | null,
  petDx: 0,
  petWidth: 156,
  friendDx: null as number | null,
  panelOpen: false
});

let loading: Promise<void> | null = null;
export const loadDock = () =>
  (loading ??= (async () => {
    const known = WIDGETS.map((w) => w.id);
    try {
      dock.list = parseDock((await api.db.getKv(DOCK_KEY)) as string | null, known);
    } catch (error) {
      logError('dock:list', error, 'warn');
      dock.list = parseDock(null, known);
    }
  })());

export const saveDock = (next: string[]) => {
  dock.list = next;
  void api.db.setKv(DOCK_KEY, serializeDock(next));
};
