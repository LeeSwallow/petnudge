import type { DataKind } from '../../renderer/data';

// What can change under a panel module: a kind of stored data, the pet's
// session (timer, active todo), the clock tick, the music, the chat, and
// 'shown': the panel or a tab was just opened, so times like "5분 전" and
// lists read from main (characters, MCP) are read again.
export type Cause = DataKind | 'session' | 'clock' | 'music' | 'chat' | 'shown';
export const CAUSES: readonly Cause[] = ['todos', 'notes', 'playlists', 'settings', 'stats', 'session', 'clock', 'music', 'chat', 'shown'];

// One counter per cause; a Svelte module reads the counter of what it shows,
// so a bump re-runs exactly the views that depend on it.
export const createRevisions = (counts: Record<Cause, number> = Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>) => ({
  counts,
  bump: (cause: Cause) => {
    counts[cause] += 1;
  }
});
