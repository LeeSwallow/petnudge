// The dock beside her (src/ui/dock): the talk button and the docked widgets.
import { check } from './lib.mjs';

export default {
  name: 'dock',
  covers: ['src/ui/dock/**', 'src/renderer/pet/**', 'src/renderer/walking.ts', 'src/main/friends.ts', 'src/main/layout.ts', 'src/ui/widgets/music/**'],
  setup: `await window.petApi.db.removeKv('widgets.dock'); return true;`,
  checks: [
    check('dock: the talk button is in the dock and always visible', `const b = $('#chat-toggle'); return [b?.closest('#dock-talk') !== null, shown(b), b?.closest('[data-hit]') !== null, $('#pet-body #chat-toggle') === b && b.closest('#dock') !== null];`, [true, true, true, true]),
    check('dock: the music widget is in it by default, the old strip is gone', `return [docked(), await window.petApi.db.getKv('widgets.dock'), $('#player-strip'), $('#dock [data-dock-widget=music]').hasAttribute('data-hit')];`, [['music:quiet'], null, null, true]),
    check('dock: beside her on the right, inside the window', `const d = $('#dock').getBoundingClientRect(), c = $('#pet').getBoundingClientRect(); return [$('#dock').dataset.side, d.left >= c.right, d.right <= innerWidth, Math.round(d.bottom) === Math.round(c.bottom)];`, ['right', true, true, true]),
    check('dock: the pointer over it pauses walking', `const before = petDebug().free; $('#dock').dispatchEvent(new PointerEvent('pointerenter')); const over = petDebug().free; $('#dock').dispatchEvent(new PointerEvent('pointerleave')); return [over, petDebug().free === before];`, [false, true]),
    check('dock: the talk button opens the quick chat, and closes it', `$('#chat-toggle').click(); await wait(100); const open = [!$('#chat-bar').hidden, document.activeElement?.id, $('#chat-toggle').getAttribute('aria-label')]; $('#chat-toggle').click(); await wait(100); return [open, $('#chat-bar').hidden];`, [[true, 'chat-quick', '입력창 닫기'], true]),
    // A friend appears 300px to her left (main/friends.ts); moving her 450px left
    // puts the friend near on her right, then back again.
    check('dock: flips away from a friend near her, and back when it leaves', `const dock = $('#dock'); dock.dispatchEvent(new PointerEvent('pointerenter')); await window.petApi.openFriend('maru'); await wait(1500); window.petApi.friendHold('maru', 60000, 0); window.petApi.moveBy(-450, 0); const flipped = await until(() => dock.dataset.side === 'left', 4000); const d = dock.getBoundingClientRect(), c = $('#pet').getBoundingClientRect(); window.petApi.moveBy(450, 0); const back = await until(() => dock.dataset.side === 'right', 4000); window.petApi.closeFriend('maru'); dock.dispatchEvent(new PointerEvent('pointerleave')); await wait(800); return [flipped, d.right <= c.left, d.left >= 0, back];`, [true, true, true, true]),
    check('dock: widgets hide while the panel is open, the talk button stays', `await openPanel(); return [docked(), shown($('#chat-toggle'))];`, [[], true]),
    check('dock: widgets come back when the panel closes', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); const closed = docked(); $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); return [closed, docked()];`, [['music:quiet'], []])
  ],
  cleanup: `window.petApi.closeFriend(); await window.petApi.db.removeKv('widgets.dock'); return true;`
};
