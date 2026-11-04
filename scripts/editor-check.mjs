// Checks the character editor window in the real app: npm run check:editor
// (it builds first). Starts the built app with a throwaway profile and HOME
// (your data is never touched), opens the editor from Settings › 캐릭터 꾸미기,
// and drives both windows over Chrome DevTools Protocol. Fails on a wrong
// result, a console error or a CSP violation in either window.
// EDITOR_CHECK_PORT runs it beside another check; EDITOR_CHECK_SHOT=<file.png>
// saves a screenshot of the editor.
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
const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], { env: { ...process.env, PETNUDGE_PROFILE: profile, HOME: home }, stdio: 'ignore' });
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
const isEditor = (t) => t.url.endsWith('/editor/index.html');
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
  await check('editor: a slot can be selected', editor, `$('[data-slot=eye]').click(); await wait(100); return $$('[data-slot][aria-pressed=true]').map((e) => e.dataset.slot);`, ['eye']);
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

  // Opened again: the same window comes forward, the page is not reloaded.
  await check('editor: marked before opening again', editor, `window.__sameEditor = true; return true;`, true);
  await check('settings: 에디터 열기 again', pet, `$('#open-editor').click(); await wait(800); return true;`, true);
  current = 'reuse';
  const editors = (await targets()).filter(isEditor);
  result('editor: opening twice reuses the one window', [editors.length, editors[0]?.id === editorTarget.id], [1, true]);
  await check('editor: same page, not reloaded', editor, `return [window.__sameEditor === true, document.hasFocus()];`, [true, true]);

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
