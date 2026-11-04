// 기록 › 메모 (src/ui/modules/notes).
import { check, T, TS } from './lib.mjs';

const CLEAR = `for (const n of await window.petApi.db.listNotes('')) await window.petApi.db.deleteNote(n.id); return true;`;

export default {
  name: 'notes',
  covers: ['src/ui/modules/notes/**', 'src/ui/widgets/pinned/**'],
  setup: CLEAR,
  checks: [
    check('notes: empty list', `await openPanel(); await open_('record', 'notes'); return text('#note-list');`, T('notes.first')),
    check('notes: new note opens the editor', `$('#note-browser .primary').click(); await wait(500); const t = $('#note-title'); return [$('#note-editor').hidden, t.value, t.selectionStart === 0 && t.selectionEnd === t.value.length];`, [false, T('notes.newTitle'), true]),
    check('notes: autosave', `type('#note-body', '미적분 정리'); await wait(900); return text('#note-status');`, T('notes.saved')),
    check('notes: pin, back, search, delete', `$('#note-pin').click(); await wait(400); const pin = text('#note-pin'); $('#note-editor .ghost').click(); await wait(200); const list = text('#note-list'); type('#note-search', '없는말'); await wait(400); const none = text('#note-list'); type('#note-search', ''); await wait(400); $('.note-card').click(); await wait(200); $('[aria-label=' + ${JSON.stringify(JSON.stringify(T('notes.delete')))} + ']').click(); await wait(400); return [pin, list.startsWith(${JSON.stringify(T('notes.pinned') + T('common.count', { count: 1 }) + ' ' + T('notes.newTitle'))}), none, text('#note-list')];`, [T('notes.pinnedOn'), true, T('notes.noResults'), T('notes.first')]),
    check('notes: editing a note found by search keeps the editor open', `await open_('record', 'notes'); $('#note-browser .primary').click(); await wait(500); type('#note-title', '미분'); await wait(800); $('#note-editor .ghost').click(); await wait(200); type('#note-search', '미분'); await wait(400); $('.note-card').click(); await wait(200); type('#note-title', '적분'); await wait(900); const open = !$('#note-editor').hidden; $('[aria-label=' + ${JSON.stringify(JSON.stringify(T('notes.delete')))} + ']').click(); await wait(300); type('#note-search', ''); await wait(300); return [open, text('#note-list')];`, [true, T('notes.first')])
  ],
  cleanup: CLEAR
};
