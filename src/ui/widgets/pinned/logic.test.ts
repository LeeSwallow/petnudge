import { describe, expect, it } from 'vitest';
import type { Note } from '../../../shared/types';
import { emptyText, pinnedView } from './logic';

const note = (id: string, pinned: boolean, updatedAt: number, title = id, body = ''): Note => ({ id, title, body, pinned, createdAt: 0, updatedAt });

describe('pinned note widget', () => {
  it('shows the newest pinned note: its title and first lines', () => {
    const notes = [note('old', true, 1), note('new', true, 5, '미적분', '\n극한\n\n미분\n적분\n급수'), note('loose', false, 9)];
    expect(pinnedView({ notes })).toEqual({ id: 'new', title: '미적분', lines: ['극한', '미분', '적분'] });
  });

  it('is empty when nothing is pinned', () => {
    expect(pinnedView({ notes: [note('a', false, 1)] })).toBeNull();
    expect(emptyText()).toBe('고정한 메모가 없어요');
  });

  it('names an untitled note', () => {
    expect(pinnedView({ notes: [note('a', true, 1, '  ')] })?.title).toBe('제목 없음');
  });
});
