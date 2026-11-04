import type { Component } from 'svelte';
import type { PixelIconName } from '../../renderer/icons';
import type { GroupId } from '../panel/groups';

export type ModuleId = 'home' | 'todo' | 'pomodoro' | 'dashboard' | 'playlist' | 'notes' | 'chat' | 'friends' | 'settings';

// A panel module: a Svelte component that reacts to `revision` by itself.
// `group` is the big tab it sits under, `order` its place among that group's
// small tabs (lower first). Register it in ./registry.ts.
export type UiModule = { id: ModuleId; label: string; icon: PixelIconName; group: GroupId; order: number; component: Component };
