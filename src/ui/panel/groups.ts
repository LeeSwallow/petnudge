import type { ModuleId } from '../modules/module';
import type { PixelIconName } from '../../renderer/icons';

// The panel's big tabs and the modules inside each (design: 큰 묶음 + 작은 탭).
// Home (the widget board, #14) and together (multiplayer) stay hidden until
// they have something to show.

export type GroupId = 'home' | 'focus' | 'record' | 'together' | 'settings';
export type Group = { id: GroupId; label: string; icon: PixelIconName; modules: ModuleId[]; hidden?: boolean };

export const GROUPS: readonly Group[] = [
  { id: 'home', label: '홈', icon: 'home', modules: [], hidden: true },
  { id: 'focus', label: '집중', icon: 'tomato', modules: ['todo', 'pomodoro', 'playlist'] },
  { id: 'record', label: '기록', icon: 'note', modules: ['notes', 'dashboard', 'chat'] },
  { id: 'together', label: '함께', icon: 'happy', modules: [], hidden: true },
  { id: 'settings', label: '설정', icon: 'gear', modules: ['settings', 'friends'] }
];

export const DEFAULT_MODULE: ModuleId = 'pomodoro';

export const visibleGroups = (): Group[] => GROUPS.filter((g) => !g.hidden);

export const groupOf = (id: ModuleId): GroupId => {
  const group = GROUPS.find((g) => g.modules.includes(id));
  if (!group) throw new Error(`module ${id} is in no group`);
  return group.id;
};

// The module saved in kv 'ui.module', if it is still one a visible group shows.
export const restoreModule = (saved: string | null): ModuleId => {
  const shown = visibleGroups().flatMap((g) => g.modules) as string[];
  return saved !== null && shown.includes(saved) ? (saved as ModuleId) : DEFAULT_MODULE;
};
