// The panel itself (src/ui/panel): opening, the group tabs, every tab.
// It is also what --changed runs when no other scenario covers a change.
import { check, T, TS } from './lib.mjs';

export default {
  name: 'panel',
  covers: ['src/ui/panel/**', 'src/renderer/pet/input.ts', 'src/renderer/fx.ts', 'src/renderer/tooltip.ts', 'src/renderer/icons.ts', 'src/renderer/fonts.css', 'src/ui/dom.ts', 'src/ui/log.ts'],
  // the module to reopen is saved; without one the panel opens on pomodoro
  setup: `await window.petApi.db.removeKv('ui.module'); return true;`,
  checks: [
    check('panel opens on right click', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); return !$('#panel').hidden;`, true),
    check('four groups, home first, none overflowing', `return $$('[data-group]').map((b) => b.textContent.trim() + (b.scrollWidth <= b.clientWidth ? '' : '!'));`, ['home', 'focus', 'record', 'settings'].map((g) => T(`panel.group.${g}`))),
    check('pomodoro opens first', `return $('[data-module][aria-selected=true]').dataset.module;`, 'pomodoro'),
    check('arrow keys move between groups', `$('[data-group=focus]').focus(); key('[data-group=focus]', 'ArrowLeft'); await wait(150); const left = [$('[data-group][aria-selected=true]').dataset.group, $$('[data-group]').map((b) => b.tabIndex)]; key('[data-group=home]', 'ArrowLeft'); await wait(150); return [left, $('[data-group][aria-selected=true]').dataset.group];`, [['home', [0, -1, -1, -1]], 'settings']),
    check('every tab renders without falling back', `const failed = []; for (const g of $$('[data-group]')) { g.click(); await wait(200); const modules = $$('[data-module]'); for (const m of modules) { m.click(); await wait(300); if ($$('[data-failed]').length) failed.push(m.dataset.module); } if (!modules.length && $$('[data-failed]').length) failed.push(g.dataset.group); } return [failed, $$('[data-failed]').length];`, [[], 0]),
    check('panel: 220px keeps both tab rows', `await open_('settings'); $('#panel').style.setProperty('--panel-height', '220px'); await wait(100); const p = $('#panel').getBoundingClientRect(), s = $('.ui-tabs.sub').getBoundingClientRect(); $('#panel').style.removeProperty('--panel-height'); return s.height > 0 && s.bottom <= p.bottom;`, true)
  ],
  cleanup: `await window.petApi.db.removeKv('ui.module'); return true;`
};
