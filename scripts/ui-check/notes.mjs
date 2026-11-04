// 기록 › 메모 (src/ui/modules/notes).
import { check } from './lib.mjs';

const CLEAR = `for (const n of await window.petApi.db.listNotes('')) await window.petApi.db.deleteNote(n.id); return true;`;

export default {
  name: 'notes',
  covers: ['src/ui/modules/notes/**', 'src/ui/widgets/pinned/**'],
  setup: CLEAR,
  checks: [
    check('notes: empty list', `await openPanel(); await open_('record', 'notes'); return text('#note-list');`, '첫 메모를 남겨보세요'),
    check('notes: new note opens the editor', `$('#note-browser .primary').click(); await wait(500); const t = $('#note-title'); return [$('#note-editor').hidden, t.value, t.selectionStart === 0 && t.selectionEnd === t.value.length];`, [false, '새 메모', true]),
    check('notes: autosave', `type('#note-body', '미적분 정리'); await wait(900); return text('#note-status');`, '저장됨'),
    check('notes: pin, back, search, delete', `$('#note-pin').click(); await wait(400); const pin = text('#note-pin'); $('#note-editor .ghost').click(); await wait(200); const list = text('#note-list'); type('#note-search', '없는말'); await wait(400); const none = text('#note-list'); type('#note-search', ''); await wait(400); $('.note-card').click(); await wait(200); $('[aria-label="메모 삭제"]').click(); await wait(400); return [pin, list.startsWith('고정1개 새 메모'), none, text('#note-list')];`, ['고정됨', true, '검색 결과가 없어요', '첫 메모를 남겨보세요']),
    check('notes: editing a note found by search keeps the editor open', `await open_('record', 'notes'); $('#note-browser .primary').click(); await wait(500); type('#note-title', '미분'); await wait(800); $('#note-editor .ghost').click(); await wait(200); type('#note-search', '미분'); await wait(400); $('.note-card').click(); await wait(200); type('#note-title', '적분'); await wait(900); const open = !$('#note-editor').hidden; $('[aria-label="메모 삭제"]').click(); await wait(300); type('#note-search', ''); await wait(300); return [open, text('#note-list')];`, [true, '첫 메모를 남겨보세요'])
  ],
  cleanup: CLEAR
};
