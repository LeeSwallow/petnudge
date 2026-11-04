// 설정 › 친구 (src/ui/modules/friends): her friends on screen.
import { check, T, TS } from './lib.mjs';

export default {
  name: 'characters',
  covers: ['src/ui/modules/friends/**', 'src/main/friends.ts', 'src/main/characters.ts', 'src/renderer/pet/friends.ts'],
  setup: `window.petApi.closeFriend(); await new Promise((r) => setTimeout(r, 600)); return true;`,
  checks: [
    check('characters: main pet stays, friends can be called', `await openPanel(); await open_('settings', 'friends'); await wait(400); return [text('#friends-count'), $$('#friends-list li').length >= 3, text('#friends-list li:first-child').includes(${TS('friends.main')}) || $$('#friends-list .hint').some((e) => e.textContent === ${TS('friends.main')}), $('#friends-clear').disabled];`, [T('friends.count', { count: 1 }), true, true, true]),
    check('characters: call a friend out and send everyone back', `$('#friends-list button.mini:not(.ghost)').click(); await wait(1500); const called = text('#friends-count'); $('#friends-clear').click(); await wait(1200); return [called, text('#friends-count')];`, [T('friends.count', { count: 2 }), T('friends.count', { count: 1 })])
  ],
  cleanup: `window.petApi.closeFriend(); return true;`
};
