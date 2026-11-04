import type { Component } from 'svelte';
import type { PixelIconName } from '../../renderer/icons';

export type ModuleId = 'todo' | 'pomodoro' | 'dashboard' | 'playlist' | 'notes' | 'chat' | 'friends' | 'settings';

// A panel module: a Svelte component that reacts to `revision` by itself.
export type UiModule = { id: ModuleId; label: string; icon: PixelIconName; component: Component };
