import type { ModuleId } from '../modules/module';
import type { PixelIconName } from '../../renderer/icons';
import { t } from '../i18n';

// The panel's big tabs (design: 큰 묶음 + 작은 탭). Which modules a group holds
// is not listed here: each module names its group and order, and the registry
// (../modules/registry.ts) gathers them. Home, the widget board, comes first;
// the panel still opens on the pomodoro (DEFAULT_MODULE) until a module is
// saved. Together (multiplayer) stays hidden until it has something to show.

export type GroupId = 'home' | 'focus' | 'record' | 'together' | 'settings';
export type Group = { id: GroupId; label: string; icon: PixelIconName; hidden?: boolean };

// What the groups need to know of a module: where it goes.
export type Placed = { readonly id: ModuleId; readonly group: GroupId; readonly order: number };

export const GROUPS: readonly Group[] = [
  { id: 'home', get label() { return t('panel.group.home'); }, icon: 'home' },
  { id: 'focus', get label() { return t('panel.group.focus'); }, icon: 'tomato' },
  { id: 'record', get label() { return t('panel.group.record'); }, icon: 'note' },
  { id: 'together', get label() { return t('panel.group.together'); }, icon: 'happy', hidden: true },
  { id: 'settings', get label() { return t('panel.group.settings'); }, icon: 'gear' }
];

export const DEFAULT_MODULE: ModuleId = 'pomodoro';

export const visibleGroups = (): Group[] => GROUPS.filter((g) => !g.hidden);

// The modules of a group, in their order: the group's small tabs.
export const modulesIn = <M extends Placed>(modules: readonly M[], group: GroupId): M[] =>
  modules.filter((m) => m.group === group).sort((a, b) => a.order - b.order);

// The modules a visible group shows, group by group.
export const shownModules = <M extends Placed>(modules: readonly M[]): M[] =>
  visibleGroups().flatMap((g) => modulesIn(modules, g.id));

export const groupOf = (modules: readonly Placed[], id: ModuleId): GroupId => {
  const module = modules.find((m) => m.id === id);
  if (!module) throw new Error(`module ${id} is not registered`);
  return module.group;
};

// The module saved in kv 'ui.module', if it is still one a visible group shows.
export const restoreModule = (modules: readonly Placed[], saved: string | null): ModuleId => {
  const shown = shownModules(modules).map((m) => m.id as string);
  return saved !== null && shown.includes(saved) ? (saved as ModuleId) : DEFAULT_MODULE;
};
