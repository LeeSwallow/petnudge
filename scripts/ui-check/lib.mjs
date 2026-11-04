// Shared by the UI check scenarios (scripts/ui-check/<name>.mjs): starting the
// built app safely, talking to it over Chrome DevTools Protocol, the helpers
// defined in the page, and running and reporting checks. Importing this file
// starts nothing; launch() does.
import { spawn } from 'node:child_process';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The language the checks run the app in (#77): UI_CHECK_LOCALE=en|ja|ko, or
// xx, the pseudo-locale (accented, about 40% longer) that catches text that
// would not fit. Korean by default. The launcher saves it in the throwaway
// profile before the first check; checks read expected wording with T(), the
// app's own catalogs bundled for node, never Korean written into a check.
export const LOCALE = process.env.UI_CHECK_LOCALE ?? 'ko';
const i18nBundle = buildSync({
  entryPoints: [fileURLToPath(new URL('../../src/i18n/index.ts', import.meta.url))],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  write: false
}).outputFiles[0].text;
const i18n = await import(`data:text/javascript;base64,${Buffer.from(i18nBundle).toString('base64')}`);
if (!i18n.isLocale(LOCALE)) throw new Error(`UI_CHECK_LOCALE must be ko, en, ja or xx, not ${LOCALE}`);
i18n.setLocale(LOCALE);
export const T = (key, params) => i18n.t(key, params);
// T() as a JavaScript string literal, to put inside a check's body.
export const TS = (key, params) => JSON.stringify(T(key, params));
// The wording in another language (the language switch checks).
export const TIn = (locale, key, params) => i18n.tIn(locale, key, params);

// One step of a scenario: `body` is the inside of an async function run in the
// pet window, and what it returns must equal `expected` (as JSON).
// { reload: true } reloads the window (and its helpers) before the check.
export const check = (name, body, expected, { reload = false } = {}) => ({ name, body, expected, reload });

// The chat talks to a stand-in `claude` CLI in a throwaway home (main looks in
// ~/.local/bin first), never to your real one: it streams 40 numbered lines,
// one every 50ms, in the CLI's stream-json format. Asked to "마크다운 보여 줘", it
// answers in Markdown instead, pausing after an unclosed ** so the check can
// see it stay text.
const MARKDOWN_REST = '게** 말이에요.\n\n- 하나\n- *둘*\n\n```js\nconst a = 1;\n```\n\n[문서](https://example.com/doc) <b>태그</b> <script>alert(1)</script>';
const STAND_IN_CLAUDE = `#!/usr/bin/env node
const out = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
out({ type: 'stream_event', event: { type: 'message_start' } });
const say = (text) => out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text } } });
if ((process.argv[process.argv.indexOf('-p') + 1] ?? '').includes('마크다운 보여 줘')) {
  say('이건 **굵');
  setTimeout(() => {
    say(${JSON.stringify(MARKDOWN_REST)});
    out({ type: 'result', subtype: 'success', is_error: false, result: '' });
  }, 1500);
  return;
}
let i = 0;
const timer = setInterval(() => {
  i += 1;
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: i + '번째 줄이에요.\\n' } } });
  if (i === 40) {
    clearInterval(timer);
    out({ type: 'result', subtype: 'success', is_error: false, result: '' });
  }
}, 50);
`;

// Helpers defined in the page after every load: $ (query), wait, click, type
// (an input event, as typing does), key (a keydown), open_ (group then
// module), openPanel (right click unless it is open). Clipboard writes are
// caught into window.copied: the system clipboard belongs to the user.
export const HELPERS = `
  window.$ = (s) => document.querySelector(s);
  window.$$ = (s) => [...document.querySelectorAll(s)];
  window.wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
  window.text = (s) => (document.querySelector(s)?.textContent ?? '').replace(/\\s+/g, ' ').trim();
  window.type = (s, value) => { const el = document.querySelector(s); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.key = (s, key) => document.querySelector(s).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  window.open_ = async (group, module) => { $('[data-group=' + group + ']').click(); if (module) $('[data-module=' + module + ']').click(); await wait(200); };
  window.openPanel = async () => { if ($('#panel').hidden) { $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); } return !$('#panel').hidden; };
  window.until = async (ok, ms = 10000) => { for (let t = 0; t < ms && !ok(); t += 50) await wait(50); return ok(); };
  window.atBottom = (el) => el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
  window.replies = () => $$('#chat-log .chat-bubble.pet:not(.thinking)').length;
  window.docked = () => $$('#dock [data-dock-widget]').map((e) => e.dataset.dockWidget + (e.hidden ? ':quiet' : ''));
  window.shown = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).opacity === '1' && el.getBoundingClientRect().width > 0;
  window.T = (key, params) => window.petnudgeI18n.t(key, params);
  window.copied = [];
  navigator.clipboard.writeText = async (t) => { window.copied.push(t); };
  return true;`;

// Starts the built app with a throwaway profile and home (your data is never
// touched) and connects to its pet window.
export const launch = async ({ port }) => {
  const profile = mkdtempSync(path.join(tmpdir(), 'petnudge-ui-check-'));
  const home = path.join(profile, 'home');
  mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
  writeFileSync(path.join(home, '.local', 'bin', 'claude'), STAND_IN_CLAUDE, { mode: 0o755 });
  const electron = createRequire(import.meta.url)('electron');
  const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], { env: { ...process.env, PETNUDGE_PROFILE: profile, HOME: home }, stdio: 'ignore' });
  const cleanup = () => {
    app.kill();
    rmSync(profile, { recursive: true, force: true });
  };

  let page;
  for (let i = 0; i < 80 && !page; i++) {
    try {
      page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page' && t.url.endsWith('index.html'));
    } catch {}
    if (!page) await sleep(250);
  }
  if (!page) {
    cleanup();
    throw new Error('the app did not open a debuggable window (run npm run build first)');
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let next = 0;
  const pending = new Map();
  const problems = [];
  let current = 'boot'; // the check running when a problem shows up
  ws.addEventListener('message', (message) => {
    const d = JSON.parse(message.data);
    if (d.id) {
      pending.get(d.id)?.(d);
      pending.delete(d.id);
      return;
    }
    if (d.method === 'Runtime.exceptionThrown') problems.push(`[${current}] exception: ${d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text}`);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') problems.push(`[${current}] console.error: ${d.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push(`[${current}] log: ${d.params.entry.text}`);
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
  // A fresh window: reload, wait until she and the dock are up, then let the
  // first data settle before defining the helpers again.
  const reload = async () => {
    await send('Page.reload');
    await sleep(300);
    for (let t = 0; t < 10000; t += 100) {
      try {
        if (await run(`return document.readyState === 'complete' && !!document.querySelector('#dock-talk #chat-toggle') && !!document.querySelector('[data-group]');`)) break;
      } catch {} // the old page may be gone mid-reload
      await sleep(100);
    }
    await sleep(700);
    await run(HELPERS);
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await reload(); // the first load came before Runtime.enable
  // the language for every check, saved like the user would (Settings › 프로필)
  await run(`await window.petApi.db.updateSettings({ locale: ${JSON.stringify(LOCALE)} }); return true;`);
  await reload();
  const active = await run('return window.petnudgeI18n.getLocale();');
  if (active !== LOCALE) {
    ws.close();
    cleanup();
    throw new Error(`the app runs in ${active}, not ${LOCALE}`);
  }
  return {
    run,
    reload,
    problems,
    setCurrent: (name) => (current = name),
    close: () => {
      ws.close();
      cleanup();
    }
  };
};

const report = (name, ok, expected, actual) =>
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(actual)}`}`);

// Runs scenarios one after another in one app. Each starts in a freshly
// reloaded window after its `setup` (data it needs absent or reset), and its
// `cleanup` removes what it made, so any subset in any order passes.
// Returns the number of failed checks and the number run.
export const runScenarios = async (session, scenarios) => {
  let failed = 0;
  let total = 0;
  for (const scenario of scenarios) {
    console.log(`\n— ${scenario.name}`);
    const started = Date.now();
    try {
      session.setCurrent(`${scenario.name}: setup`);
      if (scenario.setup) await session.run(scenario.setup);
      await session.reload();
    } catch (error) {
      failed++;
      report(`${scenario.name}: setup`, false, 'no error', `THREW ${error.message.split('\n')[0]}`);
      continue;
    }
    for (const { name, body, expected, reload } of scenario.checks) {
      session.setCurrent(name);
      total++;
      let actual;
      try {
        if (reload) await session.reload();
        actual = await session.run(body);
      } catch (error) {
        actual = `THREW ${error.message.split('\n')[0]}`;
      }
      const ok = JSON.stringify(actual) === JSON.stringify(expected);
      if (!ok) failed++;
      report(name, ok, expected, actual);
    }
    if (scenario.cleanup) {
      session.setCurrent(`${scenario.name}: cleanup`);
      try {
        await session.run(scenario.cleanup);
      } catch (error) {
        failed++;
        report(`${scenario.name}: cleanup`, false, 'no error', `THREW ${error.message.split('\n')[0]}`);
      }
    }
    console.log(`  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  }
  total++;
  if (session.problems.length) {
    failed++;
    console.log(`\n✗ console stayed clean\n    ${session.problems.join('\n    ')}`);
  } else console.log('\n✓ console stayed clean');
  return { failed, total };
};
