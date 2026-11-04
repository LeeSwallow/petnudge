// 기록 › 대시보드 (src/ui/modules/dashboard).
import { check } from './lib.mjs';

export default {
  name: 'dashboard',
  covers: ['src/ui/modules/dashboard/**', 'src/renderer/charts.ts', 'src/renderer/data.ts', 'src/renderer/data-views.css', 'src/renderer/filterBar.ts', 'src/shared/stats.ts', 'src/shared/dateFilter.ts'],
  checks: [
    check('dashboard: tiles and empty log', `await openPanel(); await open_('record', 'dashboard'); await wait(900); return [$$('#tiles .tile').length, text('#tile-today'), text('#tile-rate'), text('#log')];`, [4, '0m', '0%', '첫 뽀모도로를 끝내면 여기에 기록돼요']),
    check('dashboard: charts drawn', `return ['#week', '#hours', '#heat'].map((s) => $(s + ' svg') !== null);`, [true, true, true]),
    check('dashboard: log filter opens', `$('#log-funnel').click(); await wait(100); const shown = !$('#log-filter').hidden; $('#log-funnel').click(); return shown;`, true),
    check('dashboard: no unlock bar', `await open_('record', 'dashboard'); await wait(300); return $$('#stat-bars .bar-row span:first-child').map((s) => s.textContent).includes('해금');`, false)
  ]
};
