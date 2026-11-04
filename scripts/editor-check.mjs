// Checks the character editor window in the real app: npm run check:editor
// (it builds first). Starts the built app with a throwaway profile and HOME
// (your data is never touched), opens the editor from Settings › 캐릭터 꾸미기,
// and drives both windows over Chrome DevTools Protocol. Fails on a wrong
// result, a console error or a CSP violation in either window.
// EDITOR_CHECK_PORT runs it beside another check; EDITOR_CHECK_SHOT=<file.png>
// saves a screenshot of the editor. The app runs with PETNUDGE_EDITOR_TEST=1,
// so the editor has its dev-only test hooks (window.__editorTest, #58) to put
// parts in without the import UI, and main answers editor:test-import (#57):
// a picture or a layered file as bytes, where a real run opens a file dialog.
// EDITOR_CHECK_CUTOUT_SHOT=<file.png> saves a screenshot mid cut-out (the
// 원본 underlay, a selection and a filled layer).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writePxo } from './character/pxo.mjs';

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
  window.row = (layer) => $('[data-layer="' + layer + '"]');
  window.rows = () => $$('[data-layer]').map((e) => e.dataset.layer);
  window.pickRow = (layer) => row(layer).querySelector('[data-pick]').click();
  // Drags a layer row by its handle to just in front of (above) or behind (below) another; answers the drop line seen on the way.
  window.dragLayerRow = async (from, to, side) => {
    const a = row(from).querySelector('[data-pick]').getBoundingClientRect(); const b = row(to).getBoundingClientRect();
    const fire = (type, el, y) => el.dispatchEvent(new PointerEvent(type, { clientX: a.left + 10, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 9, isPrimary: true, bubbles: true, cancelable: true }));
    const y = side === 'front' ? b.top + 2 : b.bottom - 2;
    fire('pointerdown', row(from).querySelector('[data-pick]'), a.top + a.height / 2);
    fire('pointermove', document.body, y);
    await wait(30);
    const line = $('[data-drop-indicator]')?.dataset.dropIndicator + ':' + $('[data-drop-indicator]')?.closest('[data-layer]').dataset.layer;
    fire('pointerup', document.body, y);
    return line;
  };
  // A w×h PNG of one colour, as a dropped File.
  window.png = (w, h, color, name = 'part.png') => new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    c.toBlob((blob) => resolve(new File([blob], name, { type: 'image/png' })), 'image/png');
  });
  window.dropFile = async (el, file) => {
    const dt = new DataTransfer(); dt.items.add(file);
    el.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true }));
    el.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
    await wait(250);
  };
  // The thumbnail of a layer row: its size and whether its middle is drawn.
  window.thumb = (layer) => { const c = row(layer).querySelector('[data-thumb]'); const d = c.getContext('2d').getImageData(c.width >> 1, c.height >> 1, 1, 1).data; return [c.width, c.height, d[3] === 255]; };
  return true;`;

// Page helpers for the import checks (#57): a 96×112 picture of known blocks
// as PNG bytes, presses with modifier keys, and pixel colours as uint32
// (0xAABBGGRR, ImageData order).
const CUT_HELPERS = `
  // blue head 36..60 × 10..34, red body 30..66 × 40..100, yellow tab 66..70 × 40..60 (touching the body), green dot 10..14 × 10..14
  window.BLOCKS = [['#0000ff', 36, 10, 24, 24], ['#ff0000', 30, 40, 36, 60], ['#ffff00', 66, 40, 4, 20], ['#00ff00', 10, 10, 4, 4]];
  window.pngBytes = (w, h, blocks) => new Promise((resolve) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    for (const [color, x, y, bw, bh] of blocks) { ctx.fillStyle = color; ctx.fillRect(x, y, bw, bh); }
    c.toBlob(async (blob) => resolve([...new Uint8Array(await blob.arrayBuffer())]), 'image/png');
  });
  window.BLUE = 0xffff0000; window.RED = 0xff0000ff; window.GREEN = 0xff00ff00;
  window.loadPicture = async () => { __editorTest.reset(); return __editorTest.importBytes('image', 'char.png', await pngBytes(96, 112, BLOCKS)); };
  window.px = (layer, x, y) => __editorTest.pixel(layer, x, y);
  window.under = (x, y) => __editorTest.underlayPixel(x, y);
  // Presses canvas pixel (x, y) with modifier keys, moves by each [dx, dy], lets go.
  window.press = (x, y, steps = [], mods = {}) => {
    const o = $('[data-overlay]'); const r = o.getBoundingClientRect(); const z = zoom();
    const at = (cx, cy) => [r.left + (cx + 0.5) * z, r.top + (cy + 0.5) * z];
    const fire = (type, [cx, cy]) => o.dispatchEvent(new PointerEvent(type, { clientX: cx, clientY: cy, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 11, isPrimary: true, bubbles: true, cancelable: true, ...mods }));
    let last = at(x, y);
    fire('pointerdown', last);
    for (const [dx, dy] of steps) { last = at(x + dx, y + dy); fire('pointermove', last); }
    fire('pointerup', last);
  };
  window.tool = async (id) => { $('[data-tool-option=' + id + ']').click(); await wait(50); };
  window.cutTo = async (layer) => { const s = $('[data-cut-target]'); s.value = layer; s.dispatchEvent(new Event('change', { bubbles: true })); await wait(30); $('[data-cut]').click(); await wait(80); };
  window.pick = () => [st().picked, st().pickedBox];
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
    ['캐릭터 에디터', 'object', 'undefined', ['apply', 'close', 'importCharacter', 'importImage', 'importLayered', 'listCharacters', 'log', 'save', 'testImport']]);
  await check('editor: an ordinary window about 960×640', editor, `return [outerWidth >= 900 && outerWidth <= 1000, outerHeight >= 600 && outerHeight <= 700];`, [true, true]);
  await check('editor: the three panes render, in order', editor, `return [$$('[data-pane]').map((e) => e.dataset.pane), $$('[data-pane]').map(shown), $$('[data-pane] h2').map((e) => e.firstChild.textContent.trim())];`,
    [['slots', 'canvas', 'preview'], [true, true, true], ['레이어', '캔버스', '미리보기']]);
  await check('editor: the panes sit left, centre, right', editor, `const [a, b, c] = $$('[data-pane]').map((e) => e.getBoundingClientRect()); return [a.right <= b.left, b.right <= c.left, Math.round(a.top) === Math.round(b.top) && Math.round(b.top) === Math.round(c.top)];`, [true, true, true]);
  await check('editor: the layer panel starts with no layers and every slot as 빈 칸', editor, `return [$$('[data-layer]').length, $$('[data-empty-slot] .slot-label').map((e) => e.textContent.trim()), $$('[data-empty-slot] .required').map((e) => e.closest('[data-empty-slot]').dataset.emptySlot)];`,
    [0, ['뒷머리', '몸통', '다리', '팔', '머리(얼굴)', '눈', '입', '앞머리', '장식'], ['torso']]);
  await check('editor: every empty slot says 비어 있음', editor, `return $$('[data-empty-slot] .slot-state').map((e) => e.textContent.trim());`, Array(9).fill('비어 있음'));
  await check('editor: an empty slot can be selected', editor, `$('[data-empty-slot=eyes] button').click(); await wait(100); return [$$('[data-empty-slot] [aria-pressed=true]').map((e) => e.closest('[data-empty-slot]').dataset.emptySlot), __editorTest.state().selected];`, [['eyes'], 'eye.L.open']);
  await check('editor: the canvas is 96×112 at 4×', editor, `const c = $('[data-canvas]'); return [c.width, c.height, c.dataset.zoom, c.clientWidth, c.clientHeight, getComputedStyle(c).imageRendering, text('#canvas-title')];`,
    [96, 112, '4', 384, 448, 'pixelated', '캔버스 96×112 · 4배']);
  await check('editor: the canvas shows a checkerboard', editor, `const ctx = $('[data-canvas]').getContext('2d'); const px = (x, y) => [...ctx.getImageData(x, y, 1, 1).data].join(','); return [px(0, 0) === px(8, 0), px(0, 0) !== px(4, 0), px(0, 0) !== px(0, 4), px(95, 111) !== '0,0,0,0'];`, [true, true, true, true]);
  await check('editor: the preview is an empty frame for now', editor, `return [shown($('[data-preview-frame]')), $$('[data-preview-frame] canvas').length, text('[data-preview-frame]')];`, [true, 0, '부위를 넣으면 여기서 움직여요']);
  await check('editor: 열기 / 저장 wait for a later issue, 새로 만들기 and 불러오기 are on', editor, `return [$$('.topbar [data-action]').map((b) => b.textContent.trim() + (b.disabled ? ':off' : '')), $$('.topbar [data-import]').map((b) => b.textContent.trim() + (b.disabled ? ':off' : ''))];`,
    [['새로 만들기', '열기:off', '저장:off'], ['그림 불러오기', '레이어 파일', '다른 캐릭터에서']]);
  await check('editor: the 캐릭터 tab is a placeholder, and back', editor, `$('[data-editor-tab=character]').click(); await wait(150); const placeholder = [shown($('[data-pane=character]')), $$('[data-pane=slots]').length]; $('[data-editor-tab=parts]').click(); await wait(150); return [$$('[data-editor-tab]').map((e) => e.textContent.trim()), placeholder, $$('[data-pane]').length];`,
    [['부위', '캐릭터'], [true, 0], 3]);
  await check('editor: lists characters over editor:list-characters', editor, `const r = await editorApi.listCharacters(); return [r.ok, r.value.find((c) => c.id === 'lila'), Object.keys(r.value[0]).sort(), text('[data-character-count]') === '캐릭터 ' + r.value.length + '개'];`,
    [true, { id: 'lila', name: '리라', builtin: true }, ['builtin', 'id', 'name'], true]);
  await check('editor: save and apply answer not_implemented', editor, `const rs = await Promise.all([editorApi.save(), editorApi.apply()]); return rs.map((r) => r.ok === false && r.error.code);`, Array(2).fill('not_implemented'));

  // Placement and undo (#58), with two synthetic parts put in over the test hooks.
  await check('editor: test hooks are on under PETNUDGE_EDITOR_TEST', editor, `return [new URLSearchParams(location.search).get('test'), typeof window.__editorTest, Object.keys(window.__editorTest).sort()];`, ['1', 'object', ['importBytes', 'pixel', 'reset', 'setPart', 'state', 'underlayPixel']]);
  await editor.run(PLACE_HELPERS);
  await check('placement: two parts go in as layer rows, front-most on top, with thumbnails', editor, `await twoParts(); return [st().drawn, st().selected, rows(), $$('[data-empty-slot]').map((e) => e.dataset.emptySlot).filter((s) => s === 'torso' || s === 'head'), thumb('head'), thumb('torso.chest'), $$('[data-layer] .slot-label').map((e) => e.textContent.trim())];`,
    [['torso.chest', 'head'], 'head', ['head', 'torso.chest'], [], [28, 28, true], [36, 60, true], ['머리(얼굴)', '몸통']]);
  await check('placement: the canvas draws them back to front over the checkerboard', editor, `return [art(40, 44), art(32, 90), art(0, 0) === art(8, 0), art(0, 0) !== art(4, 0)];`, ['0,0,255,255', '255,0,0,255', true, true]);
  await check('placement: the selected part has a 1px outline', editor, `const o = $('[data-overlay]'); return [o.dataset.selection, outline(34, 20), outline(34, 20, 1)];`, ['34,20,62,48', true, false]);
  await check('placement: clicking a layer row selects its part', editor, `pickRow('torso.chest'); await wait(80); return [st().selected, $('[data-overlay]').dataset.selection, $$('[data-layer] [data-pick][aria-pressed=true]').map((e) => e.closest('[data-layer]').dataset.layer)];`, ['torso.chest', '30,40,66,100', ['torso.chest']]);
  await check('placement: arrows move 1px, Shift+arrows 8px', editor, `key('ArrowRight'); key('ArrowRight'); key('ArrowRight'); key('ArrowDown', { shiftKey: true }); key('ArrowLeft'); await wait(80); return [box('torso.chest'), $('[data-overlay]').dataset.selection];`, [[32, 48, 68, 108], '32,48,68,108']);
  await check('placement: quick nudges are one undo step, and redo', editor, `key('z', { metaKey: true }); await wait(80); const undone = box('torso.chest'); key('z', { metaKey: true, shiftKey: true }); await wait(80); return [undone, box('torso.chest'), st().canRedo];`, [[30, 40, 66, 100], [32, 48, 68, 108], false]);
  await check('placement: a part stops at the canvas edge', editor, `await wait(600); for (let i = 0; i < 4; i++) key('ArrowDown', { shiftKey: true }); for (let i = 0; i < 6; i++) key('ArrowRight', { shiftKey: true }); await wait(80); return box('torso.chest');`, [60, 52, 96, 112]);
  await check('placement: dragging moves the part under the pointer, snapped to pixels', editor, `await twoParts(); const at = drag(40, 30, [[2, 1], [5.3, -2.8], [5, -3]]); await wait(80); return [at, st().selected, box('head')];`, ['head', 'head', [39, 17, 67, 45]]);
  await check('placement: a drag is one undo step', editor, `undoButton().click(); await wait(80); return [box('head'), st().canRedo];`, [[34, 20, 62, 48], true]);
  await check('placement: a drag stops at the canvas edge', editor, `drag(40, 30, [[-50, -50]]); await wait(80); return box('head');`, [0, 0, 28, 28]);
  await check('placement: dragging a layer row below another draws it behind, with a drop line', editor, `await twoParts(); const line = await dragLayerRow('head', 'torso.chest', 'back'); await wait(80); return [line, rows(), st().drawn, art(40, 44), st().selected];`,
    ['back:torso.chest', ['torso.chest', 'head'], ['head', 'torso.chest'], '255,0,0,255', 'head']);
  await check('placement: Alt+↑ brings it forward again, undo and redo restore the order', editor, `row('head').querySelector('[data-pick]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true, cancelable: true })); await wait(80); const front = [st().drawn, art(40, 44), document.activeElement === row('head').querySelector('[data-pick]')]; undoButton().click(); await wait(50); const behind = st().drawn; undoButton().click(); await wait(50); const start = st().drawn; $('[data-history=redo]').click(); await wait(80); return [front, behind, start, st().drawn];`,
    [[['torso.chest', 'head'], '0,0,255,255', true], ['head', 'torso.chest'], ['torso.chest', 'head'], ['head', 'torso.chest']]);
  await check('placement: clicking the canvas picks the top-most part under the pointer', editor, `await twoParts(); const a = drag(40, 44, []); const b = drag(32, 90, []); const c = drag(2, 2, []); return [a, b, c];`, ['head', 'torso.chest', 'torso.chest']);
  await check('placement: hovering a row lights its part and dims the others', editor, `row('torso.chest').dispatchEvent(new PointerEvent('pointerenter')); await wait(80); const lit = [$('[data-overlay]').dataset.hovered, art(32, 90), art(40, 25) !== '0,0,255,255']; row('torso.chest').dispatchEvent(new PointerEvent('pointerleave')); await wait(80); return [lit, $('[data-overlay]').dataset.hovered, art(40, 25)];`,
    [['torso.chest', '255,0,0,255', true], '', '0,0,255,255']);
  await check('placement: the eye hides a part on the canvas only, and adds no undo step', editor, `await twoParts(); row('head').querySelector('[data-eye]').click(); await wait(80); const hidden = [row('head').dataset.hidden, art(40, 25) === art(40, 25) && art(40, 25) !== '0,0,255,255', art(40, 44), drag(40, 44, [])]; undoButton().click(); await wait(80); const undone = st().drawn; $('[data-history=redo]').click(); await wait(80); const back = [st().drawn, st().hidden]; row('head').querySelector('[data-eye]').click(); await wait(80); return [hidden, undone, back, art(40, 25)];`,
    [['true', true, '255,0,0,255', 'torso.chest'], ['torso.chest'], [['torso.chest', 'head'], ['head']], '0,0,255,255']);
  await check('placement: a locked part cannot be picked or moved on the canvas', editor, `await twoParts(); row('head').querySelector('[data-lock]').click(); await wait(50); pickRow('torso.chest'); await wait(50); const picked = drag(40, 25, [[5, 5]]); await wait(50); pickRow('head'); await wait(50); key('ArrowRight'); key('Delete'); await wait(80); const after = [box('head'), row('head').dataset.locked]; row('head').querySelector('[data-lock]').click(); await wait(50); return [picked, after, drag(40, 25, [[1, 0]])];`,
    ['torso.chest', [[34, 20, 62, 48], 'true'], 'head']);
  await check('placement: a PNG dropped on an empty slot fills it (centred), too big is refused', editor, `await twoParts(); await dropFile($('[data-empty-slot=hairBack]'), await png(10, 6, '#00ff00', 'hair.png')); const filled = [st().drawn, box('hair.back'), st().selected, thumb('hair.back'), $$('[data-empty-slot]').some((e) => e.dataset.emptySlot === 'hairBack')]; await dropFile($('[data-empty-slot=legs]'), await png(100, 20, '#00ff00')); return [filled, text('[data-notice]').includes('96×112'), Object.keys(st().boxes).includes('leg.L')];`,
    [[['hair.back', 'torso.chest', 'head'], [43, 53, 53, 59], 'hair.back', [10, 6, true], false], true, false]);
  await check('placement: a PNG dropped on a layer row replaces it, on the canvas fills the selected slot, a decoration gets a name', editor, `await dropFile(row('head'), await png(8, 8, '#ffff00')); const replaced = box('head'); $('[data-empty-slot=mouth] button').click(); await wait(50); await dropFile($('[data-overlay]'), await png(4, 2, '#ff00ff')); const mouth = box('mouth.closed'); await dropFile($('[data-empty-slot=custom]'), await png(2, 2, '#ffffff', 'bow.png')); return [replaced, mouth, rows(), text('[data-notice]')];`,
    [[44, 52, 52, 60], [46, 55, 50, 57], ['custom.bow', 'mouth.closed', 'head', 'torso.chest', 'hair.back'], '']);
  await check('placement: Delete clears the selected part, undo brings it back', editor, `await twoParts(); pickRow('torso.chest'); await wait(50); key('Delete'); await wait(80); const gone = [Object.keys(st().boxes), rows(), $$('[data-empty-slot]').some((e) => e.dataset.emptySlot === 'torso'), art(32, 90) !== '255,0,0,255']; key('z', { ctrlKey: true }); await wait(80); return [gone, box('torso.chest'), rows(), art(32, 90)];`,
    [[['head'], ['head'], true, true], [30, 40, 66, 100], ['head', 'torso.chest'], '255,0,0,255']);
  await check('placement: the guides show the feet line and head box, and toggle off', editor, `const o = $('[data-overlay]'); const on = [o.dataset.feet, o.dataset.head, overlayAt(2, 100 * zoom()), overlayAt(0, 60 * zoom())]; $('[data-guide=feet]').click(); $('[data-guide=border]').click(); await wait(80); const off = [overlayAt(2, 100 * zoom()), overlayAt(0, 60 * zoom()), $$('[data-guide][aria-pressed=false]').map((e) => e.dataset.guide)]; $('[data-guide=feet]').click(); $('[data-guide=border]').click(); await wait(50); return [on, off];`,
    [['100', '34,20,62,48', true, true], [false, false, ['border', 'feet']]]);
  for (const z of [6, 2, 4]) {
    await check(`placement: at ${z}× the canvas, overlay and pointer stay on the pixel grid`, editor, `$('[data-zoom-option="${z}"]').click(); await wait(100); const c = $('[data-canvas]'); const o = $('[data-overlay]'); const [cr, or] = [c.getBoundingClientRect(), o.getBoundingClientRect()];
      const same = cr.left === or.left && cr.top === or.top && cr.width === or.width && cr.height === or.height;
      const at = drag(35, 21, [[1, 1]]); await wait(80); const moved = box('head'); undoButton().click(); await wait(50);
      return [c.dataset.zoom, c.clientWidth, c.clientHeight, o.width, same, text('#canvas-title'), at, moved, outline(34, 20), $$('[data-zoom-option][aria-pressed=true]').map((e) => e.dataset.zoomOption)];`,
      [String(z), 96 * z, 112 * z, 96 * z, true, `캔버스 96×112 · ${z}배`, 'head', [35, 21, 63, 49], true, [String(z)]]);
  }

  // Bringing pictures in (#57): one picture cut into parts, a layered file, another character's parts.
  await editor.run(CUT_HELPERS);
  await check('import: 그림 불러오기 (bytes over editor:test-import) shows the picture as the 원본 underlay', editor, `const r = await loadPicture(); await wait(100); const u = st().underlay;
    return [r, u.name, u.rest, u.restCount, st().tool, st().drawn, $('[data-underlay] .slot-label')?.textContent, shown($('[data-cutout]')), Number(art(40, 60).split(',')[0]) > 120, art(40, 60) !== '255,0,0,255'];`,
    ['ok', 'char.png', [10, 10, 70, 100], 24 * 24 + 36 * 60 + 4 * 20 + 16, 'box', [], '원본', true, true, true]);
  await check('import: a picture bigger than 96×112 gets the size guidance', editor, `const r = await __editorTest.importBytes('image', 'big.png', await pngBytes(100, 120, [['#ff0000', 0, 0, 4, 4]])); return [r.includes('96×112 이하'), st().underlay.name];`, [true, 'char.png']);
  await check('cutout: dragging a box selects the pixels in it', editor, `press(36, 10, [[10, 10], [23, 23]]); await wait(80); return [...pick(), $('[data-overlay]').dataset.picked, text('[data-picked-chip]')];`,
    [576, [36, 10, 60, 34], '576', '576픽셀']);
  await check('cutout: 칸에 넣기 puts the selection in the slot at the same coordinates and takes it out of the 원본', editor, `await cutTo('head'); const u = st().underlay;
    return [box('head'), px('head', 36, 10) === BLUE, px('head', 59, 33) === BLUE, under(36, 10), u.restCount, u.rest, st().picked, rows(), st().selected, text('[data-notice]')];`,
    [[36, 10, 60, 34], true, true, 0, 36 * 60 + 80 + 16, [10, 10, 70, 100], 0, ['head'], 'head', '']);
  await check('cutout: undo puts the pixels back in the 원본 and empties the slot, redo cuts again', editor, `undoButton().click(); await wait(80); const undone = [box('head'), under(36, 10) === BLUE, st().underlay.restCount]; $('[data-history=redo]').click(); await wait(80); return [undone, box('head'), under(36, 10)];`,
    [[null, true, 2832], [36, 10, 60, 34], 0]);
  await check('cutout: same-colour select takes the touching region of exactly that colour', editor, `await tool('color'); press(40, 60); await wait(80); return [st().tool, ...pick()];`, ['color', 2160, [30, 40, 66, 100]]);
  if (process.env.EDITOR_CHECK_CUTOUT_SHOT) {
    const { data } = await editor.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(process.env.EDITOR_CHECK_CUTOUT_SHOT, Buffer.from(data, 'base64'));
    console.log(`  screenshot: ${process.env.EDITOR_CHECK_CUTOUT_SHOT}`);
  }
  await check('cutout: Shift adds a region, Alt takes a box away', editor, `press(67, 45, [], { shiftKey: true }); await wait(50); const added = pick(); await tool('box'); press(30, 40, [[35, 29]], { altKey: true }); await wait(80); return [added, pick()];`,
    [[2240, [30, 40, 70, 100]], [1160, [30, 40, 70, 100]]]);
  await check('cutout: the cut keeps exact positions for a combined selection', editor, `await cutTo('torso.chest'); return [box('torso.chest'), px('torso.chest', 30, 70) === RED, px('torso.chest', 30, 69), px('torso.chest', 69, 59) !== 0, under(30, 69) === RED, under(30, 70)];`,
    [[30, 40, 70, 100], true, 0, true, true, 0]);
  await check('cutout: Esc clears the selection, ⌘A selects the whole picture', editor, `key('a', { metaKey: true }); await wait(50); const all = st().picked; key('Escape'); await wait(50); return [all, st().picked, $('[data-select=clear]').disabled];`, [96 * 112, 0, true]);
  await check('cutout: a selection with nothing drawn in it is refused and adds no step', editor, `const before = st().canRedo; press(80, 100, [[10, 10]]); await wait(50); const picked = st().picked; await cutTo('arm.L'); return [picked, text('[data-notice]').includes('고른 픽셀이 없어요'), Object.keys(st().boxes).includes('arm.L'), st().picked];`,
    [121, true, false, 121]);
  await check('cutout: the selection dropped on a layer row goes into that slot', editor, `key('Escape'); await tool('color'); press(11, 11); await wait(50); const dt = new DataTransfer(); dt.setData('application/x-petnudge-selection', '16'); const target = $('[data-empty-slot=hairFront]');
    target.dispatchEvent(new DragEvent('dragover', { dataTransfer: dt, bubbles: true, cancelable: true })); target.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true })); await wait(80);
    return [box('hair.front'), px('hair.front', 10, 10) === GREEN, under(10, 10), st().picked];`, [[10, 10, 14, 14], true, 0, 0]);
  await check('cutout: the 원본 has its own eye, view only (no undo step)', editor, `const undoBefore = st().canUndo; const before = art(30, 69); $('[data-underlay] [data-eye]').click(); await wait(80); const hidden = [st().underlay.shown, $('[data-underlay]').dataset.hidden, art(30, 69) !== before]; $('[data-underlay] [data-eye]').click(); await wait(50); return [hidden, st().underlay.shown, st().canUndo === undoBefore];`,
    [[false, 'true', true], true, true]);
  await check('cutout: the move tool picks and drags parts again', editor, `await tool('move'); const at = drag(40, 20, [[2, 0]]); await wait(80); const moved = box('head'); undoButton().click(); await wait(50); return [at, moved, $('[data-overlay]').dataset.tool];`, ['head', [38, 10, 62, 34], 'move']);
  await check('import: a PNG dropped on the canvas with nothing selected becomes the 원본', editor, `__editorTest.reset(); await wait(50); await dropFile($('[data-overlay]'), await png(10, 6, '#00ff00', 'dropped.png')); return [st().underlay?.name, st().underlay?.rest, st().drawn, st().tool];`,
    ['dropped.png', [43, 53, 53, 59], [], 'box']);

  // A small layered file made here: two standard layers, one with another name, one empty.
  const pxoFile = path.join(profile, 'parts.pxo');
  const block = ([x0, y0, x1, y1], [r, g, b]) => {
    const rgba = new Uint8Array(96 * 112 * 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([r, g, b, 255], (y * 96 + x) * 4);
    return rgba;
  };
  await writePxo(pxoFile, { width: 96, height: 112, layers: [
    { name: 'torso.chest', group: '', rgba: block([30, 50, 66, 100], [255, 0, 0]) },
    { name: 'head', group: 'face', rgba: block([34, 20, 62, 48], [0, 0, 255]) },
    { name: 'Ribbon 1', group: '', rgba: block([50, 14, 58, 20], [255, 0, 255]) },
    { name: 'Sketch', group: '', rgba: block([0, 0, 96, 112], [9, 9, 9]) },
    { name: 'empty', group: '', rgba: new Uint8Array(96 * 112 * 4) }
  ] });
  const pxoBytes = JSON.stringify([...readFileSync(pxoFile)]);
  await check('layered: a .pxo fills the slots of its standard layer names and asks about the rest', editor, `__editorTest.reset(); await wait(30); const r = await __editorTest.importBytes('layered', 'parts.pxo', ${pxoBytes}); await wait(100); const d = $('[data-layered-dialog]');
    return [r, d.open, $$('[data-matched] [data-layer-name]').map((e) => e.dataset.layerName), $$('[data-unmatched] [data-layer-name]').map((e) => e.dataset.layerName), st().drawn];`,
    ['ok', true, ['torso.chest', 'head'], ['Ribbon 1', 'Sketch'], []]);
  await check('layered: a slot for one layer, skip another, all in one undo step', editor, `const [ribbon, sketch] = $$('[data-unmatched] select'); ribbon.value = 'custom:new'; ribbon.dispatchEvent(new Event('change', { bubbles: true })); await wait(30); $('[data-layered-dialog] [data-dialog-ok]').click(); await wait(100);
    const placed = [$('[data-layered-dialog]').open, st().drawn, box('custom.Ribbon1'), box('head'), text('[data-notice]')]; undoButton().click(); await wait(80); return [placed, st().drawn, st().canUndo];`,
    [[false, ['torso.chest', 'head', 'custom.Ribbon1'], [50, 14, 58, 20], [34, 20, 62, 48], 'parts.pxo에서 레이어 3개를 넣었어요'], [], false]);
  await check('layered: a file other than .pxo/.aseprite is refused with a message', editor, `return await __editorTest.importBytes('layered', 'art.psd', [1, 2, 3]);`, '레이어 파일은 .pxo나 .aseprite만 읽을 수 있어요: art.psd');

  await check('character: 다른 캐릭터에서 가져오기 lists lila\'s parts (converted) and what is dropped', editor, `__editorTest.reset(); await wait(30); $('[data-import=character]').click(); await wait(100); const s = $('[data-character-select]'); s.value = 'lila'; s.dispatchEvent(new Event('change', { bubbles: true })); await wait(50);
    for (let i = 0; i < 50 && ($('[data-loading]') || !$('[data-parts]')); i++) await wait(100);
    const parts = $$('[data-part]').map((e) => e.dataset.part);
    return [$('[data-character-dialog]').dataset.characterDialog, parts.includes('head') && parts.includes('torso.chest') && parts.includes('hair.front'), $$('[data-part] input:checked').length === parts.length, /빠지는 것 \\d+개/.test(text('[data-dropped] summary')), $('[data-dropped]').open];`,
    ['parts', true, true, true, false]);
  await check('character: the ticked parts are copied in, one undo step', editor, `for (const input of $$('[data-part] input')) if (!['head', 'torso.chest'].includes(input.closest('[data-part]').dataset.part)) input.click(); await wait(50); $('[data-character-dialog] [data-dialog-ok]').click(); await wait(100);
    const copied = [$('[data-character-dialog]').open, st().drawn.slice().sort(), text('[data-notice]').includes('부위 2개')]; undoButton().click(); await wait(80); return [copied, st().drawn, st().canUndo];`,
    [[false, ['head', 'torso.chest'], true], [], false]);
  await check('character: 새로 만들기 › 기존 캐릭터에서 시작 shows what is dropped and starts from lila, undoable', editor, `$('[data-action=new]').click(); await wait(50); $('[data-new=character]').click(); await wait(100); const s = $('[data-character-select]'); if (s.value !== 'lila') { s.value = 'lila'; s.dispatchEvent(new Event('change', { bubbles: true })); } await wait(50);
    for (let i = 0; i < 50 && ($('[data-loading]') || !$('[data-dropped]')); i++) await wait(100);
    const dialog = [$('[data-character-dialog]').dataset.characterDialog, $('[data-dropped]').open, $$('[data-dropped] li').length > 0]; $('[data-character-dialog] [data-dialog-ok]').click(); await wait(150);
    const started = [st().drawn.length > 5, st().drawn.includes('head'), st().canUndo]; undoButton().click(); await wait(80); return [dialog, started, st().drawn];`,
    [['start', true, true], [true, true, true], []]);
  await check('character: 새로 만들기 › 빈 캐릭터 empties the draft, undoable', editor, `await twoParts(); $('[data-action=new]').click(); await wait(50); $('[data-new=blank]').click(); await wait(80); const blank = [st().drawn, $$('[data-new-menu]').length]; undoButton().click(); await wait(80); return [blank, st().drawn];`,
    [[[], 0], ['torso.chest', 'head']]);

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
