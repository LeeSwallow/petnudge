// Text that would not fit (#77): the app in the pseudo-locale `xx` (English
// accented and about 40% longer, src/i18n/pseudo.ts), every tab, the AI page,
// the widgets on the board and in the dock. Tabs, buttons, labels and widgets
// must not overflow: scrollWidth <= clientWidth, except text drawn to be cut
// with an ellipsis (a long todo title, a song name).
import { LOCALE, check } from './lib.mjs';

// UI_CHECK_OVERFLOW_LOCALE=en|ja|ko measures a real language the same way.
const TARGET = process.env.UI_CHECK_OVERFLOW_LOCALE ?? 'xx';
const SET = (locale) => `await window.petApi.db.updateSettings({ locale: '${locale}' }); return true;`;
const KEEP = ['widgets.board', 'widgets.dock', 'ui.module'];

// In the page: the visible elements under `root` whose text overflows them.
const OVERFLOWING = `
  const KINDS = 'button, [role=tab], .ui-tab .text, .chip, .section-title, label, .hint, .bar-row > span, .tile span, .ui-widget header > span, output, select, .stepper > span, .row > span, .ai-label, .slot-label, .day-head > *, .empty, [data-timer-phase], .timer-intent, .legend';
  const visible = (e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0;
  const name = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.attributes].filter((a) => a.name.startsWith('data-') && a.name !== 'data-tip').map((a) => '[' + a.name + '=' + a.value + ']').join('') + ' "' + e.textContent.trim().slice(0, 24) + '"';
  window.overflowing = (root) => [...root.querySelectorAll(KINDS)]
    .filter((e) => visible(e) && getComputedStyle(e).textOverflow !== 'ellipsis' && e.scrollWidth > e.clientWidth + 1)
    .map(name);
  window.pageOverflow = (root) => (root.scrollWidth > root.clientWidth + 1 ? ['scrolls sideways: ' + root.className] : []);`;

export default {
  name: 'overflow',
  covers: ['src/i18n/**', 'src/ui/components/**', 'src/ui/i18n.ts', 'src/renderer/styles.css', 'src/renderer/data-views.css', 'scripts/ui-check/lib.mjs'],
  setup: `${SET(TARGET).replace('return true;', '')} for (const k of ${JSON.stringify(KEEP)}) await window.petApi.db.removeKv(k); return true;`,
  checks: [
    check('overflow: the app runs in the pseudo-locale', `${OVERFLOWING} return [window.petnudgeI18n.getLocale(), TARGET !== 'xx' || /[áéíöü]/.test($('[data-group=home]').textContent)];`.replace('TARGET', JSON.stringify(TARGET)), [TARGET, true]),
    check('overflow: no tab of the panel overflows', `${OVERFLOWING} await openPanel(); const found = [];
      for (const g of $$('[data-group]')) {
        g.click(); await wait(250);
        const modules = $$('[data-module]');
        for (const m of modules.length ? modules : [null]) {
          if (m) { m.click(); await wait(350); }
          const body = $('.tab-body:not([hidden])');
          found.push(...overflowing($('#panel')).map((x) => (m?.dataset.module ?? g.dataset.group) + ': ' + x), ...pageOverflow(body));
        }
      }
      return found;`, []),
    check('overflow: the AI chat settings page fits', `${OVERFLOWING} await open_('settings', 'settings'); $('#ai-open').click(); await wait(400); const found = [...overflowing($('#ai-page')), ...pageOverflow($('.tab-body:not([hidden])'))]; $('[data-action=ai-back]').click(); await wait(200); return found;`, []),
    check('overflow: the pomodoro while it runs and pauses fits', `${OVERFLOWING} await open_('focus', 'pomodoro'); $('#controls .primary').click(); await wait(600); const running = overflowing($('#panel')); $('#controls .primary').click(); await wait(300); const paused = overflowing($('#panel')); $$('#controls button')[1].click(); await wait(300); return [running, paused];`, [[], []]),
    check('overflow: widgets in the dock fit', `${OVERFLOWING} await window.petApi.db.setKv('widgets.dock', JSON.stringify(['timer', 'todos'])); return true;`, true),
    check('overflow: widgets in the dock fit beside her', `${OVERFLOWING} if (!$('#panel').hidden) { $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); } await wait(300); return [$$('#dock [data-dock-widget]').length > 0, overflowing($('#dock'))];`, [true, []], { reload: true })
  ],
  cleanup: `${SET(LOCALE).replace('return true;', '')} for (const k of ${JSON.stringify(KEEP)}) await window.petApi.db.removeKv(k); return true;`
};
