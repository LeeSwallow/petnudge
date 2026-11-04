// 집중 › 할 일 (src/ui/modules/todo).
import { check, T, TS } from './lib.mjs';

const CLEAR = `for (const t of await window.petApi.db.listTodos()) await window.petApi.db.deleteTodo(t.id); return true;`;

export default {
  name: 'todo',
  covers: ['src/ui/modules/todo/**', 'src/ui/widgets/todos/**', 'src/renderer/filterBar.ts', 'src/shared/dateFilter.ts'],
  setup: CLEAR,
  checks: [
    check('todo: empty list', `await openPanel(); await open_('focus', 'todo'); return text('#todo-open');`, T('todo.empty')),
    check('todo: add with Enter', `type('#todo-input', '영어 단어'); key('#todo-input', 'Enter'); await wait(400); return [$('#todo-input').value, $$('#todo-open .todo-title').map((e) => e.textContent.trim())];`, ['', ['영어 단어']]),
    check('todo: estimate stays within 1..12', `const [down, up] = $$('.estimate button'); down.click(); await wait(50); const low = text('#todo-estimate'); for (let i = 0; i < 15; i++) up.click(); await wait(50); return [low, text('#todo-estimate')];`, ['1', '12']),
    check('todo: typed text survives a group switch', `type('#todo-input', '공부 중'); await open_('record'); await open_('focus'); return [$('#todo-input').value, $('[data-module][aria-selected=true]').dataset.module];`, ['공부 중', 'todo']),
    check('todo: check off and clear', `type('#todo-input', ''); $('#todo-open .todo-check').click(); await wait(400); const done = $$('#todo-done .todo').length; $('#todo-done-title button').click(); await wait(400); return [text('#todo-open'), done, $$('#todo-done .todo').length];`, [T('todo.empty'), 1, 0]),
    check('todo: a checked-off row pops into the done list', `type('#todo-input', '팝'); key('#todo-input', 'Enter'); await wait(400); $('#todo-open .todo-check').click(); let popped = false; for (let i = 0; i < 20 && !popped; i++) { await wait(25); popped = $$('#todo-done .todo.pop').length > 0; } $('#todo-done-title button').click(); await wait(300); return popped;`, true),
    check('todo: filter opens', `$('#todo-funnel').click(); await wait(100); const shown = !$('#todo-filter').hidden; $('#todo-funnel').click(); return shown;`, true)
  ],
  cleanup: CLEAR
};
