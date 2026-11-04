import type { Note } from '../../../shared/types';
import { t } from '../../i18n';

// The pinned note widget's view, apart from the screen and from whose notes
// it is (tested in logic.test.ts).

export type PinnedSource = { notes: readonly Note[] };

export const emptyText = () => t('widgets.pinned.empty');
const LINES = 3;

// The pinned note edited last, its title and its first non-empty lines.
export const pinnedView = ({ notes }: PinnedSource) => {
  const note = notes.filter((n) => n.pinned).reduce<Note | null>((newest, n) => (newest === null || n.updatedAt > newest.updatedAt ? n : newest), null);
  if (!note) return null;
  const lines = note.body.split('\n').map((l) => l.trim()).filter((l) => l !== '').slice(0, LINES);
  return { id: note.id, title: note.title.trim() || t('common.untitled'), lines };
};
