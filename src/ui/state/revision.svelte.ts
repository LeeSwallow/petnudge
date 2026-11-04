import { CAUSES, createRevisions, type Cause } from './bridge';

// The reactive counters (see bridge.ts). renderer.ts bumps them wherever the
// older code re-rendered the active module.
const counts = $state(Object.fromEntries(CAUSES.map((c) => [c, 0])) as Record<Cause, number>);
const revisions = createRevisions(counts);

export const revision = revisions.counts;
export const bump = revisions.bump;
