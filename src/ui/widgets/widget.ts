import type { Component } from 'svelte';

export type WidgetId = 'clock' | 'timer' | 'todos' | 'pinned' | 'music';

// A widget: a small Svelte component for the home board (and later the dock
// beside the pet). `size` is how many of the board's two columns it takes.
// The component shows the pet's own data unless it is given another feed, so
// a friend's pomodoro can use the same widget. Register it in ./registry.ts.
export type Widget = { id: WidgetId; label: string; size: 1 | 2; component: Component };
