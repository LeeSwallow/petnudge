// 집중 › 뽀모도로 (src/ui/modules/pomodoro). The timer lives in the window,
// so the reload before every scenario stops it.
import { check } from './lib.mjs';

export default {
  name: 'pomodoro',
  covers: ['src/ui/modules/pomodoro/**', 'src/ui/widgets/timer/**', 'src/renderer/pet/state.ts', 'src/renderer/fx.ts'],
  checks: [
    check('pomodoro: idle', `await openPanel(); await open_('focus', 'pomodoro'); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작']),
    check('pomodoro: start ticks', `$('#controls .primary').click(); await wait(2300); return [text('#digits') !== '25:00' && text('#digits').startsWith('24:5'), text('#controls')];`, [true, '일시정지 그만두기']),
    check('pomodoro: pause holds', `$('#controls .primary').click(); await wait(300); const a = text('#digits'); await wait(1200); return [a === text('#digits'), $('#digits').classList.contains('paused'), text('#controls')];`, [true, true, '재개 그만두기']),
    check('pomodoro: abandon resets', `$$('#controls button')[1].click(); await wait(300); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작'])
  ]
};
