// Checks the character editor window in the real app: npm run check:editor
// (it builds first). Starts the built app with a throwaway profile and HOME
// (your data is never touched), opens the editor from Settings › 캐릭터 꾸미기,
// and drives both windows over Chrome DevTools Protocol. Fails on a wrong
// result, a console error or a CSP violation in either window.
// EDITOR_CHECK_PORT runs it beside another check; EDITOR_CHECK_SHOT=<file.png>
// saves a screenshot of the editor. The app runs with PETNUDGE_EDITOR_TEST=1,
// so the editor has its dev-only test hooks (window.__editorTest, #58) to put
// parts in without the import UI.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = Number(process.env.EDITOR_CHECK_PORT ?? 9353);
const profile = mkdtempSync(path.join(tmpdir(), 'petnudge-editor-check-'));
const home = path.join(profile, 'home');
mkdirSync(home, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const electron = createRequire(import.meta.url)('electron');
const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], { env: { ...process.env, PETNUDGE_PROFILE: profile, HOME: home, PETNUDGE_EDITOR_TEST: '1' }, stdio: 'ignore' });
const cleanup = () => {
  app.kill();
  rmSync(profile, { recursive: true, force: true });
};

const targets = async () => {
  try {
    return (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).filter((t) => t.type === 'page');
  } catch {
    return [];
  }
};
const isPet = (t) => t.url.endsWith('/renderer/index.html');
const isEditor = (t) => t.url.split('?')[0].endsWith('/editor/index.html');
const findTarget = async (match, tries = 80) => {
  for (let i = 0; i < tries; i++) {
    const found = (await targets()).find(match);
    if (found) return found;
    await sleep(250);
  }
  return null;
};

let current = 'boot'; // the check running when a problem shows up
const problems = [];

// One DevTools connection to a window; `run` evaluates the inside of an
// async function there and returns its value.
const connect = async (target, label) => {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let next = 0;
  const pending = new Map();
  ws.addEventListener('message', (message) => {
    const d = JSON.parse(message.data);
    if (d.id) {
      pending.get(d.id)?.(d);
      pending.delete(d.id);
      return;
    }
    const where = `[${label} · ${current}]`;
    if (d.method === 'Runtime.exceptionThrown') problems.push(`${where} exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push(`${where} console.error: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push(`${where} log: ${d.params.entry.text}`);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, (d) => (d.error ? reject(new Error(d.error.message)) : resolve(d.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const run = async (body) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  // Listen first, then reload, so nothing from the page's start is missed.
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.__csp = []; addEventListener('securitypolicyviolation', (e) => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI + ' at ' + e.sourceFile + ':' + e.lineNumber));` });
  await send('Page.reload');
  await sleep(2000);
  await run(HELPERS);
  return { target, send, run, close: () => ws.close() };
};

const HELPERS = `
  window.$ = (s) => document.querySelector(s);
  window.$$ = (s) => [...document.querySelectorAll(s)];
  window.wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
  window.text = (s) => (document.querySelector(s)?.textContent ?? '').replace(/\\s+/g, ' ').trim();
  window.shown = (el) => !!el && el.offsetParent !== null && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0;
  return true;`;

// Page helpers for the placement checks: synthetic parts, keys, pointer drags
// and list drags, and reads of the art canvas and the overlay.
const PLACE_HELPERS = `
  window.rgba = (x0, y0, x1, y1, [r, g, b]) => {
    const a = new Array(96 * 112 * 4).fill(0);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a.splice((y * 96 + x) * 4, 4, r, g, b, 255);
    return a;
  };
  window.twoParts = async () => {
    __editorTest.reset();
    __editorTest.setPart('torso.chest', rgba(30, 40, 66, 100, [255, 0, 0]));
    __editorTest.setPart('head', rgba(34, 20, 62, 48, [0, 0, 255]));
    await wait(80);
  };
  window.st = () => __editorTest.state();
  window.box = (layer) => st().boxes[layer];
  window.zoom = () => Number($('[data-canvas]').dataset.zoom);
  window.key = (k, mods = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods }));
  window.undoButton = () => $('[data-history=undo]');
  window.art = (x, y) => [...$('[data-canvas]').getContext('2d').getImageData(x, y, 1, 1).data].join(',');
  window.overlayAt = (x, y) => $('[data-overlay]').getContext('2d').getImageData(x, y, 1, 1).data[3] > 0;
  // The outline's top-left corner at canvas pixel (x, y), or \`inset\` screen pixels inside it.
  window.outline = (x, y, inset = 0) => { const z = zoom(); const d = $('[data-overlay]').getContext('2d').getImageData(x * z + inset, y * z + inset, 1, 1).data; return d[3] === 255 && d[0] === 255 && d[1] === 255 && d[2] === 255; };
  // Presses on canvas pixel (x, y), moves by each [dx, dy] (canvas pixels), lets go; answers the selection.
  window.drag = (x, y, steps) => {
    const o = $('[data-overlay]'); const r = o.getBoundingClientRect(); const z = zoom();
    const sx = r.left + (x + 0.5) * z, sy = r.top + (y + 0.5) * z;
    const fire = (type, cx, cy) => o.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 7, isPrimary: true, bubbles: true, cancelable: true }));
    fire('pointerdown', sx, sy);
    const selected = st().selected;
    let last = [sx, sy];
    for (const [dx, dy] of steps) { last = [sx + dx * z, sy + dy * z]; fire('pointermove', ...last); }
    fire('pointerup', ...last);
    return selected;
  };
  // Drags a slot row in the part list onto another (HTML drag and drop).
  window.dragRow = (from, to) => {
    const dt = new DataTransfer();
    const fire = (type, el) => el.dispatchEvent(new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }));
    const [a, b] = [$('[data-slot-row=' + from + ']'), $('[data-slot-row=' + to + ']')];
    fire('dragstart', a); fire('dragover', b); fire('drop', b); fire('dragend', a);
  };
  return true;`;

// Settings › 설정 in the pet window, then 에디터 열기.
const OPEN_FROM_SETTINGS = `
  if ($('#panel').hidden) { $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); }
  $('[data-group=settings]').click(); $('[data-module=settings]').click(); await wait(400);
  const button = $('#open-editor');
  if (!button) return 'no #open-editor';
  button.click(); await wait(200);
  return [text('#open-editor'), button.closest('.setting-group')?.previousElementSibling?.textContent.trim().startsWith('캐릭터 꾸미기')];`;

let failed = 0;
let total = 0;
const result = (name, actual, expected) => {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(actual)}`}`);
};
const check = async (name, win, body, expected) => {
  current = name;
  let actual;
  try {
    actual = await win.run(body);
  } catch (error) {
    actual = `THREW ${error.message.split('\n')[0]}`;
  }
  result(name, actual, expected);
};

const windows = [];
try {
  const petTarget = await findTarget(isPet);
  if (!petTarget) throw new Error('the app did not open a debuggable pet window (run npm run build first)');
  const pet = await connect(petTarget, 'pet');
  windows.push(pet);

  await check('settings: 에디터 열기 is under 캐릭터 꾸미기', pet, OPEN_FROM_SETTINGS, ['에디터 열기', true]);
  current = 'editor opens';
  const editorTarget = await findTarget(isEditor, 40);
  result('editor: a window opens on the editor page', Boolean(editorTarget), true);
  if (!editorTarget) throw new Error('no editor window');
  const editor = await connect(editorTarget, 'editor');
  windows.push(editor);

  await check('editor: own page, editorApi only (no petApi)', editor, `return [document.title, typeof window.editorApi, typeof window.petApi, Object.keys(window.editorApi).sort()];`,
    ['캐릭터 에디터', 'object', 'undefined', ['apply', 'close', 'importImage', 'importLayered', 'listCharacters', 'log', 'save']]);
  await check('editor: an ordinary window about 960×640', editor, `return [outerWidth >= 900 && outerWidth <= 1000, outerHeight >= 600 && outerHeight <= 700];`, [true, true]);
  await check('editor: the three panes render, in order', editor, `return [$$('[data-pane]').map((e) => e.dataset.pane), $$('[data-pane]').map(shown), $$('[data-pane] h2').map((e) => e.firstChild.textContent.trim())];`,
    [['slots', 'canvas', 'preview'], [true, true, true], ['부위', '캔버스', '미리보기']]);
  await check('editor: the panes sit left, centre, right', editor, `const [a, b, c] = $$('[data-pane]').map((e) => e.getBoundingClientRect()); return [a.right <= b.left, b.right <= c.left, Math.round(a.top) === Math.round(b.top) && Math.round(b.top) === Math.round(c.top)];`, [true, true, true]);
  await check('editor: the slot list shows the standard slots by label', editor, `return [$$('[data-slot] .slot-label').map((e) => e.textContent.trim()), $$('[data-slot] .required').map((e) => e.closest('[data-slot]').dataset.slot)];`,
    [['뒷머리', '몸통', '다리', '팔', '머리(얼굴)', '눈', '입', '앞머리', '장식'], ['torso']]);
  await check('editor: every slot starts empty', editor, `return $$('[data-slot]').map((e) => e.dataset.state + ':' + text('[data-slot=' + CSS.escape(e.dataset.slot) + '] .slot-state'));`, Array(9).fill('empty:비어 있음'));
  await check('editor: a slot can be selected', editor, `$('[data-slot=eyes]').click(); await wait(100); return $$('[data-slot][aria-pressed=true]').map((e) => e.dataset.slot);`, ['eyes']);
  await check('editor: the canvas is 96×112 at 4×', editor, `const c = $('[data-canvas]'); return [c.width, c.height, c.dataset.zoom, c.clientWidth, c.clientHeight, getComputedStyle(c).imageRendering, text('#canvas-title')];`,
    [96, 112, '4', 384, 448, 'pixelated', '캔버스 96×112 · 4배']);
  await check('editor: the canvas shows a checkerboard', editor, `const ctx = $('[data-canvas]').getContext('2d'); const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].join(','); return [px(0, 0) === px(8, 0), px(0, 0) !== px(4, 0), px(0, 0) !== px(0, 4), px(95, 111) !== '0,0,0,0'];`, [true, true, true, true]);
  await check('editor: the preview is an empty frame for now', editor, `return [shown($('[data-preview-frame]')), $$('[data-preview-frame] canvas').length, text('[data-preview-frame]')];`, [true, 0, '부위를 넣으면 여기서 움직여요']);
  await check('editor: 새로 만들기 / 열기 / 저장 wait for later issues', editor, `return $$('.topbar [data-action]').map((b) => b.textContent.trim() + (b.disabled ? ':off' : ''));`, ['새로 만들기:off', '열기:off', '저장:off']);
  await check('editor: the 캐릭터 tab is a placeholder, and back', editor, `$('[data-editor-tab=character]').click(); await wait(150); const placeholder = [shown($('[data-pane=character]')), $$('[data-pane=slots]').length]; $('[data-editor-tab=parts]').click(); await wait(150); return [$$('[data-editor-tab]').map((e) => e.textContent.trim()), placeholder, $$('[data-pane]').length];`,
    [['부위', '캐릭터'], [true, 0], 3]);
  await check('editor: lists characters over editor:list-characters', editor, `const r = await editorApi.listCharacters(); return [r.ok, r.value.find((c) => c.id === 'lila'), Object.keys(r.value[0]).sort(), text('[data-character-count]') === '캐릭터 ' + r.value.length + '개'];`,
    [true, { id: 'lila', name: '리라', builtin: true }, ['builtin', 'id', 'name'], true]);
  await check('editor: import, save and apply answer not_implemented', editor, `const rs = await Promise.all([editorApi.importImage(), editorApi.importLayered(), editorApi.save(), editorApi.apply()]); return rs.map((r) => r.ok === false && r.error.code);`, Array(4).fill('not_implemented'));

  // Placement and undo (#58), with two synthetic parts put in over the test hooks.
  await check('editor: test hooks are on under PETNUDGE_EDITOR_TEST', editor, `return [new URLSearchParams(location.search).get('test'), typeof window.__editorTest, Object.keys(window.__editorTest).sort()];`, ['1', 'object', ['reset', 'setPart', 'state']]);
  await editor.run(PLACE_HELPERS);
  await check('placement: two parts go in, the list shows them filled', editor, `await twoParts(); return [st().drawn, st().selected, $$('[data-slot]').filter((e) => e.dataset.state === 'filled').map((e) => e.dataset.slot + ':' + e.querySelector('.slot-state').textContent.trim())];`,
    [['torso.chest', 'head'], 'head', ['torso:채워짐', 'head:채워짐']]);
  await check('placement: the canvas draws them back to front over the checkerboard', editor, `return [art(40, 44), art(32, 90), art(0, 0) === art(8, 0), art(0, 0) !== art(4, 0)];`, ['0,0,255,255', '255,0,0,255', true, true]);
  await check('placement: the selected part has a 1px outline', editor, `const o = $('[data-overlay]'); return [o.dataset.selection, outline(34, 20), outline(34, 20, 1)];`, ['34,20,62,48', true, false]);
  await check('placement: clicking a slot selects its part', editor, `$('[data-slot=torso]').click(); await wait(80); return [st().selected, $('[data-overlay]').dataset.selection, $$('[data-slot][aria-pressed=true]').map((e) => e.dataset.slot)];`, ['torso.chest', '30,40,66,100', ['torso']]);
  await check('placement: arrows move 1px, Shift+arrows 8px', editor, `key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); key('ArrowDown', { shiftKey: true }); key('ArrowLeft'); await wait(80); return [box('torso.chest'), $('[data-overlay]').dataset.selection];`, [[32, 48, 68, 108], '32,48,68,108']);
  await check('placement: quick nudges are one undo step, and redo', editor, `key('z', { metaKey: true }); await wait(80); const undone = box('torso.chest'); key('z', { metaKey: true, shiftKey: true }); await wait(80); return [undone, box('torso.chest'), st().canRedo];`, [[30, 40, 66, 100], [32, 48, 68, 108], false]);
  await check('placement: a part stops at the canvas edge', editor, `await wait(600); for (let i = 0; i < 4; i++) key('ArrowDown', { shiftKey: true }); for (let i = 0; i < 6; i++) key('ArrowRight', { shiftKey: true }); await wait(80); return box('torso.chest');`, [60, 52, 96, 112]);
  await check('placement: dragging moves the part under the pointer, snapped to pixels', editor, `await twoParts(); const at = drag(40, 30, [[2, 1], [5.3, -2.8], [5, -3]]); await wait(80); return [at, st().selected, box('head')];`, ['head', 'head', [39, 17, 67, 45]]);
  await check('placement: a drag is one undo step', editor, `undoButton().click(); await wait(80); return [box('head'), st().canRedo];`, [[34, 20, 62, 48], true]);
  await check('placement: a drag stops at the canvas edge', editor, `drag(40, 30, [[-50, -50]]); await wait(80); return box('head');`, [0, 0, 28, 28]);
  await check('placement: drag a slot in the list to draw it behind', editor, `await twoParts(); const order = () => $$('[data-slot-row]').map((e) => e.dataset.slotRow); const before = order(); dragRow('head', 'torso'); await wait(80); return [before.indexOf('head') > before.indexOf('torso'), order().indexOf('head') < order().indexOf('torso'), st().drawn, art(40, 44)];`,
    [true, true, ['head', 'torso.chest'], '255,0,0,255']);
  await check('placement: ▼ brings it forward again, undo and redo restore the order', editor, `$('[data-slot-row=head] [data-order=down]').click(); await wait(80); const front = [st().drawn, art(40, 44)]; undoButton().click(); await wait(50); const behind = st().drawn; undoButton().click(); await wait(50); const start = st().drawn; $('[data-history=redo]').click(); await wait(80); return [front, behind, start, st().drawn];`,
    [[['torso.chest', 'head'], '0,0,255,255'], ['head', 'torso.chest'], ['torso.chest', 'head'], ['head', 'torso.chest']]);
  await check('placement: Delete clears the selected part, undo brings it back', editor, `await twoParts(); $('[data-slot=torso]').click(); await wait(50); key('Delete'); await wait(80); const gone = [Object.keys(st().boxes), text('[data-slot=torso] .slot-state'), art(32, 90) === art(32, 91) || art(32, 90) !== '255,0,0,255']; key('z', { ctrlKey: true }); await wait(80); return [gone, box('torso.chest'), text('[data-slot=torso] .slot-state'), art(32, 90)];`,
    [[['head'], '비어 있음', true], [30, 40, 66, 100], '채워짐', '255,0,0,255']);
  await check('placement: the guides show the feet line and head box, and toggle off', editor, `const o = $('[data-overlay]'); const on = [o.dataset.feet, o.dataset.head, overlayAt(2, 100 * zoom()), overlayAt(0, 60 * zoom())]; $('[data-guide=feet]').click(); $('[data-guide=border]').click(); await wait(80); const off = [overlayAt(2, 100 * zoom()), overlayAt(0, 60 * zoom()), $$('[data-guide][aria-pressed=false]').map((e) => e.dataset.guide)]; $('[data-guide=feet]').click(); $('[data-guide=border]').click(); await wait(50); return [on, off];`,
    [['100', '34,20,62,48', true, true], [false, false, ['border', 'feet']]]);
  for (const z of [6, 2, 4]) {
    await check(`placement: at ${z}× the canvas, overlay and pointer stay on the pixel grid`, editor, `$('[data-zoom-option="${z}"]').click(); await wait(100); const c = $('[data-canvas]'); const o = $('[data-overlay]'); const [cr, or] = [c.getBoundingClientRect(), o.getBoundingClientRect()];
      const same = cr.left === or.left && cr.top === or.top && cr.width === or.width && cr.height === or.height;
      const at = drag(35, 21, [[1, 1]]); await wait(80); const moved = box('head'); undoButton().click(); await wait(50);
      return [c.dataset.zoom, c.clientWidth, c.clientHeight, o.width, same, text('#canvas-title'), at, moved, outline(34, 20), $$('[data-zoom-option][aria-pressed=true]').map((e) => e.dataset.zoomOption)];`,
      [String(z), 96 * z, 112 * z, 96 * z, true, `캔버스 96×112 · ${z}배`, 'head', [35, 21, 63, 49], true, [String(z)]]);
  }

  // Opened again: the same window comes forward, the page is not reloaded.
  await check('editor: marked before opening again', editor, `window.__sameEditor = true; return true;`, true);
  await check('settings: 에디터 열기 again', pet, `$('#open-editor').click(); await wait(800); return true;`, true);
  current = 'reuse';
  const editors = (await targets()).filter(isEditor);
  result('editor: opening twice reuses the one window', [editors.length, editors[0]?.id === editorTarget.id], [1, true]);
  await check('editor: same page, not reloaded', editor, `return window.__sameEditor === true;`, true); // focus is not checked: an unfocused desktop (other apps, CI) cannot give it

  if (process.env.EDITOR_CHECK_SHOT) {
    const { data } = await editor.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(process.env.EDITOR_CHECK_SHOT, Buffer.from(data, 'base64'));
    console.log(`  screenshot: ${process.env.EDITOR_CHECK_SHOT}`);
  }

  // zod (bundled in the pet window) probes once whether eval is allowed, in a
  // try/catch, and turns it off when the CSP says no: expected, so not counted.
  const ZOD_EVAL_PROBE = /^script-src eval at /;
  for (const [label, win] of [['pet', pet], ['editor', editor]]) {
    await check(`${label}: no CSP violations`, win, `return window.__csp.filter((v) => !${label === 'pet' ? ZOD_EVAL_PROBE : /$^/}.test(v));`, []);
  }

  await check('editor: editor:close closes it', editor, `setTimeout(() => editorApi.close(), 0); return true;`, true);
  current = 'close';
  await sleep(800);
  result('editor: the window is gone, the pet stays', [(await targets()).filter(isEditor).length, (await targets()).filter(isPet).length], [0, 1]);
} catch (error) {
  failed++;
  console.log(`✗ ${current}: ${error.message}`);
} finally {
  total++;
  if (problems.length) {
    failed++;
    console.log(`✗ console stayed clean in both windows\n    ${problems.join('\n    ')}`);
  } else console.log('✓ console stayed clean in both windows');
  for (const win of windows) win.close();
  cleanup();
}
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${total} checks passed`);
process.exit(failed ? 1 : 0);
