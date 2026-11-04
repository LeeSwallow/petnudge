import { data } from '../../../renderer/data';
import type { PinnedSource } from './logic';

// Where a pinned note widget reads its notes (the pet's own, or later a friend's).
export type PinnedFeed = { read: () => PinnedSource };

export const myNotes: PinnedFeed = { read: () => ({ notes: data.notes }) };
