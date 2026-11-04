import { describe, expect, it } from 'vitest';
import { CAUSES, createRevisions } from './bridge';

describe('revisions', () => {
  it('bumps on every data kind', () => {
    const r = createRevisions();
    r.bump('todos');
    r.bump('todos');
    r.bump('session');
    expect(r.counts.todos).toBe(2);
    expect(r.counts.session).toBe(1);
    expect(r.counts.notes).toBe(0);
  });

  it('starts every cause at zero', () => {
    expect(Object.values(createRevisions().counts)).toEqual(CAUSES.map(() => 0));
  });
});
