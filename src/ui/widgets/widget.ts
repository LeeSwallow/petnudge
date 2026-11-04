import type { Component } from 'svelte';

export type WidgetId = 'clock' | 'timer' | 'todos' | 'pinned' | 'music';

// A widget: a small Svelte component for the home board and the dock beside
// the pet. `size` is how many of the board's two columns it takes. The
// component shows the pet's own data unless it is given another feed, so a
// friend's pomodoro can use the same widget. `quiet` says it has nothing to
// show right now; the dock leaves it out then (the board shows its empty
// state). Register it in ./registry.ts.
export type Widget = { id: WidgetId; label: string; size: 1 | 2; component: Component; quiet?: () => boolean };
