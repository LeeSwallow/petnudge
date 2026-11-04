// Checks the panel in the real app: npm run check:ui (after npm run build).
// Starts the built app with a throwaway profile (your data is never touched),
// clicks through every tab with Chrome DevTools Protocol and checks what the
// screen shows. Fails on a wrong result, a console error or a CSP violation.
// Each check is one step of the scenario below; add one when a tab gains
// behaviour.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = 9343;
const profile = mkdtempSync(path.join(tmpdir(), 'petnudge-ui-check-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const electron = createRequire(import.meta.url)('electron');
const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], { env: { ...process.env, PETNUDGE_PROFILE: profile }, stdio: 'ignore' });

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
// Runs `body` (the inside of an async function) in the pet window.
const run = async (body) => {
  const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: `(async () => { ${body} })()`, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result.value;
};

// Helpers defined once in the page: $ (query), wait, click, type (an input
// event, as typing does), key (a keydown), open (group then module).
const HELPERS = `
  window.$ = (s) => document.querySelector(s);
  window.$$ = (s) => [...document.querySelectorAll(s)];
  window.wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
  window.text = (s) => (document.querySelector(s)?.textContent ?? '').replace(/\\s+/g, ' ').trim();
  window.type = (s, value) => { const el = document.querySelector(s); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true })); };
  window.key = (s, key) => document.querySelector(s).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  window.open_ = async (group, module) => { $('[data-group=' + group + ']').click(); if (module) $('[data-module=' + module + ']').click(); await wait(200); };
  return true;`;

const checks = [];
const check = (name, body, expected) => checks.push({ name, body, expected });

// ---- the scenario ----
check('panel opens on right click', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); return !$('#panel').hidden;`, true);
check('three groups, none overflowing', `return $$('[data-group]').map((b) => b.textContent.trim() + (b.scrollWidth <= b.clientWidth ? '' : '!'));`, ['집중', '기록', '설정']);
check('pomodoro opens first', `return $('[data-module][aria-selected=true]').dataset.module;`, 'pomodoro');
check('arrow keys move between groups', `$('[data-group=focus]').focus(); key('[data-group=focus]', 'ArrowLeft'); await wait(150); return [$('[data-group][aria-selected=true]').dataset.group, $$('[data-group]').map((b) => b.tabIndex)];`, ['settings', [-1, -1, 0]]);

check('todo: empty list', `await open_('focus', 'todo'); return text('#todo-open');`, '할 일이 비었어요');
check('todo: add with Enter', `type('#todo-input', '영어 단어'); key('#todo-input', 'Enter'); await wait(400); return [$('#todo-input').value, $$('#todo-open .todo-title').map((e) => e.textContent.trim())];`, ['', ['영어 단어']]);
check('todo: estimate stays within 1..12', `const [down, up] = $$('.estimate button'); down.click(); await wait(50); const low = text('#todo-estimate'); for (let i = 0; i < 15; i++) up.click(); await wait(50); return [low, text('#todo-estimate')];`, ['1', '12']);
check('todo: typed text survives a group switch', `type('#todo-input', '공부 중'); await open_('record'); await open_('focus'); return [$('#todo-input').value, $('[data-module][aria-selected=true]').dataset.module];`, ['공부 중', 'todo']);
check('todo: check off and clear', `type('#todo-input', ''); $('#todo-open .todo-check').click(); await wait(400); const done = $$('#todo-done .todo').length; $('#todo-done-title button').click(); await wait(400); return [text('#todo-open'), done, $$('#todo-done .todo').length];`, ['할 일이 비었어요', 1, 0]);
check('todo: filter opens', `$('#todo-funnel').click(); await wait(100); const shown = !$('#todo-filter').hidden; $('#todo-funnel').click(); return shown;`, true);

check('pomodoro: idle', `await open_('focus', 'pomodoro'); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작']);
check('pomodoro: start ticks', `$('#controls .primary').click(); await wait(2300); return [text('#digits') !== '25:00' && text('#digits').startsWith('24:5'), text('#controls')];`, [true, '일시정지 그만두기']);
check('pomodoro: pause holds', `$('#controls .primary').click(); await wait(300); const a = text('#digits'); await wait(1200); return [a === text('#digits'), $('#digits').classList.contains('paused'), text('#controls')];`, [true, true, '재개 그만두기']);
check('pomodoro: abandon resets', `$$('#controls button')[1].click(); await wait(300); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작']);

check('notes: empty list', `await open_('record', 'notes'); return text('#note-list');`, '첫 메모를 남겨보세요');
check('notes: new note opens the editor', `$('#note-browser .primary').click(); await wait(500); return [$('#note-editor').hidden, $('#note-title').value, document.activeElement === $('#note-title')];`, [false, '새 메모', true]);
check('notes: autosave', `type('#note-body', '미적분 정리'); await wait(900); return text('#note-status');`, '저장됨');
check('notes: pin, back, search, delete', `$('#note-pin').click(); await wait(400); const pin = text('#note-pin'); $('#note-editor .ghost').click(); await wait(200); const list = text('#note-list'); type('#note-search', '없는말'); await wait(400); const none = text('#note-list'); type('#note-search', ''); await wait(400); $('.note-card').click(); await wait(200); $('[aria-label="메모 삭제"]').click(); await wait(400); return [pin, list.startsWith('고정1개 새 메모'), none, text('#note-list')];`, ['고정됨', true, '검색 결과가 없어요', '첫 메모를 남겨보세요']);

check('music: no lists yet', `await open_('focus', 'playlist'); return [text('#items'), text('#list-select')];`, ['위에서 새 플레이리스트를 만들어보세요', '플레이리스트 없음']);
check('music: new list with Enter', `type('#new-list', '집중 음악'); key('#new-list', 'Enter'); await wait(400); return [$('#new-list').value, text('#list-select'), text('#items'), $$('#focus-list option').map((o) => o.textContent)];`, ['', '집중 음악', '곡을 추가해보세요', ['(없음 · 이어서 재생/일시정지)', '집중 음악 (0)']]);
check('music: timer sync is saved', `$('#sync').click(); await wait(300); return $('#sync').checked;`, true);
check('music: a wrong link is refused', `$('details.external').open = true; type('#link', 'https://example.com'); key('#link', 'Enter'); await wait(200); return text('#playlist-hint');`, 'Spotify 트랙/앨범/플레이리스트 링크만 지원해요');
check('music: delete the list', `$('[aria-label="목록 삭제"]').click(); await wait(400); return text('#items');`, '위에서 새 플레이리스트를 만들어보세요');
check('dashboard: tiles and empty log', `await open_('record', 'dashboard'); await wait(900); return [$$('#tiles .tile').length, text('#tile-today'), text('#tile-rate'), text('#log')];`, [4, '0m', '0%', '첫 뽀모도로를 끝내면 여기에 기록돼요']);
check('dashboard: charts drawn', `return ['#week', '#hours', '#heat'].map((s) => $(s + ' svg') !== null);`, [true, true, true]);
check('dashboard: log filter opens', `$('#log-funnel').click(); await wait(100); const shown = !$('#log-filter').hidden; $('#log-funnel').click(); return shown;`, true);

check('characters: main pet stays, friends can be called', `await open_('settings', 'friends'); await wait(400); return [text('#friends-count'), $$('#friends-list li').length >= 3, text('#friends-list li:first-child').includes('대표') || $$('#friends-list .hint').some((e) => e.textContent === '대표'), $('#friends-clear').disabled];`, ['화면에 1마리', true, true, true]);
check('characters: call a friend out and send everyone back', `$('#friends-list button.mini:not(.ghost)').click(); await wait(1500); const called = text('#friends-count'); $('#friends-clear').click(); await wait(1200); return [called, text('#friends-count')];`, ['화면에 2마리', '화면에 1마리']);
check('settings: steppers change and save', `await open_('settings', 'settings'); await wait(300); const before = text('#out-focusMinutes'); $('#out-focusMinutes').nextElementSibling.click(); await wait(400); const after = text('#out-focusMinutes'); $('#out-focusMinutes').previousElementSibling.click(); await wait(400); return [before, after, text('#out-focusMinutes'), text('#out-petScale')];`, ['25분', '30분', '25분', '2배']);
check('settings: a toggle saves', `const box = $('[data-bool=autoStartFocus]'); const was = box.checked; box.click(); await wait(400); const now = box.checked; box.click(); await wait(400); return [now === !was, box.checked === was];`, [true, true]);
check('settings: character list and dress-up', `return [$$('#character-select option').length >= 3, $('#character-select').value, $$('#dressup .slot-row').length > 0];`, [true, 'lila', true]);
check('settings: nickname saves', `type('#nickname', '민'); $('#nickname').dispatchEvent(new Event('change', { bubbles: true })); await wait(400); return $('#nickname').value;`, '민');
check('settings: backup and MCP sections', `await wait(500); return [$$('#backup-box button').length, text('#mcp-box').includes('Claude Code')];`, [2, true]);
check('settings: AI page opens over the list and goes back', `$('#ai-open').click(); await wait(400); const open = [!$('#ai-page').hidden, getComputedStyle($('#nickname')).display === 'none' || $('#nickname').offsetParent === null]; $('#ai-page [data-action=ai-back]').click(); await wait(300); return [open, $('#ai-page').hidden];`, [[true, true], true]);
check('chat: 크게 보기 opens 기록 › 대화', `$('#chat-quick-full').click(); await wait(200); return [$('[data-group][aria-selected=true]').dataset.group, $('[data-module][aria-selected=true]').dataset.module];`, ['record', 'chat']);
check('chat: 크게 보기 shows her current conversation', `return [$('#chat-session-view').hidden, text('#chat-log').includes('말을 걸어 봐요'), $('#chat-input') !== null];`, [false, true, true]);
check('chat: back to the friend list, pet unfolded', `$('[aria-label="목록으로"]').click(); await wait(300); return [$('#chat-list-view').hidden, $('.chat-friend.open .chat-friend-name').textContent.includes('지금 펫'), $$('.chat-friend').length >= 3];`, [false, true, true]);
check('chat: new conversation, rename, delete with a second press', `$('.chat-friend.open .chat-new').click(); await wait(300); const t = $('#chat-title-input'); t.value = '수학 질문'; t.dispatchEvent(new Event('change', { bubbles: true })); await wait(200); $('[aria-label="목록으로"]').click(); await wait(300); const titles = $$('.chat-friend.open .chat-session b').map((b) => b.textContent); const before = $$('.chat-friend.open .chat-session-row').length; const del = () => $$('.chat-friend.open .chat-session-row').find((r) => r.textContent.includes('수학 질문')).querySelector('[aria-label="대화 삭제"]'); del().click(); await wait(100); const asked = del().textContent; del().click(); await wait(300); return [titles.includes('수학 질문'), asked, $$('.chat-friend.open .chat-session-row').length === before - 1];`, [true, '?', true]);
check('settings: quit button under settings', `await open_('settings'); return $('[data-quit]') !== null;`, true);
check('panel: 220px keeps both tab rows', `$('#panel').style.setProperty('--panel-height', '220px'); await wait(100); const p = $('#panel').getBoundingClientRect(), s = $('.ui-tabs.sub').getBoundingClientRect(); $('#panel').style.removeProperty('--panel-height'); return s.height > 0 && s.bottom <= p.bottom;`, true);

// ---- run ----
let failed = 0;
try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.reload');
  await sleep(2500);
  await run(HELPERS);
  for (const { name, body, expected } of checks) {
    current = name;
    let actual;
    try {
      actual = await run(body);
    } catch (error) {
      actual = `THREW ${error.message.split('\n')[0]}`;
    }
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (!ok) failed++;
    console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(actual)}`}`);
  }
  if (problems.length) {
    failed++;
    console.log(`✗ console stayed clean\n    ${problems.join('\n    ')}`);
  } else console.log('✓ console stayed clean');
} finally {
  ws.close();
  cleanup();
}
console.log(failed ? `\n${failed} check(s) failed` : `\nall ${checks.length + 1} checks passed`);
process.exit(failed ? 1 : 0);
