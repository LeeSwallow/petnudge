// The pixel flip desk clock widget (src/ui/widgets/clock) on the home board.
import { check, T, TS } from './lib.mjs';

export default {
  name: 'clock',
  covers: ['src/ui/widgets/clock/**'],
  setup: `await window.petApi.db.removeKv('widgets.board'); return true;`,
  checks: [
    check('home: the clock is added from the menu, two columns wide', `await openPanel(); await open_('home'); $('[data-widget-add]').click(); await wait(100); const offered = $$('[data-widget-add-menu] [data-add]').map((e) => e.dataset.add); $('[data-add=clock]').click(); await wait(300); const cell = $('[data-widget=clock]'), board = $('[data-board]'); return [offered, $$('[data-widget]').map((e) => e.dataset.widget), Math.abs(cell.getBoundingClientRect().width - board.getBoundingClientRect().width) < 2, $('[data-widget-add]').disabled];`, [['clock'], ['timer', 'todos', 'pinned', 'music', 'clock'], true, true]),
    check('home: the clock shows the time (24-hour) and the date', `const face = () => { const d = new Date(); const two = (n) => String(n).padStart(2, '0'); return [two(d.getHours()), two(d.getMinutes()), window.petnudgeI18n.formatDate(d, { month: 'long', day: 'numeric', weekday: 'short' })]; }; const before = JSON.stringify(face()); await wait(300); const shown = JSON.stringify([text('[data-clock-digits=hours]'), text('[data-clock-digits=minutes]'), text('[data-clock-date]')]); return shown === before || shown === JSON.stringify(face());`, true),
    check('home: a new minute flips the minutes card, briefly', `const real = Date.now; const offset = (60 - new Date().getSeconds()) * 1000; const was = text('[data-clock-digits=minutes]'); Date.now = () => real.call(Date) + offset; try { await until(() => text('[data-clock-digits=minutes]') !== was, 1000); const flipping = [$('[data-clock-card=minutes]').hasAttribute('data-flipping'), $('[data-clock-card=hours]').hasAttribute('data-flipping') === (text('[data-clock-digits=minutes]') === '00')]; await wait(450); return [flipping, $$('[data-clock] [data-flipping]').length]; } finally { Date.now = real; }`, [[true, true], 0]),
    check('home: the clock can be taken off again', `$('[aria-label=' + ${JSON.stringify(JSON.stringify(T('widgets.menuLabel', { title: T('widgets.clock.title') })))} + ']').click(); await wait(100); $('[data-widget=clock] [data-widget-action=remove]').click(); await wait(300); return [$$('[data-widget]').map((e) => e.dataset.widget), $('[data-clock]') === null, await window.petApi.db.getKv('widgets.board')];`, [['timer', 'todos', 'pinned', 'music'], true, '["timer","todos","pinned","music"]'])
  ],
  cleanup: `await window.petApi.db.removeKv('widgets.board'); return true;`
};
