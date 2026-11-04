// Checks the panel in the real app: npm run check:ui (after npm run build).
// Starts the built app with a throwaway profile (your data is never touched),
// clicks through every tab with Chrome DevTools Protocol and checks what the
// screen shows. Fails on a wrong result, a console error or a CSP violation.
// Each check is one step of the scenario below; add one when a tab gains
// behaviour.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const port = Number(process.env.UI_CHECK_PORT ?? 9343); // set it to run checks side by side
const profile = mkdtempSync(path.join(tmpdir(), 'petnudge-ui-check-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const electron = createRequire(import.meta.url)('electron');

// The chat talks to a stand-in `claude` CLI in a throwaway home (main looks in
// ~/.local/bin first), never to your real one: it streams 40 numbered lines,
// one every 50ms, in the CLI's stream-json format.
const home = path.join(profile, 'home');
mkdirSync(path.join(home, '.local', 'bin'), { recursive: true });
writeFileSync(path.join(home, '.local', 'bin', 'claude'), `#!/usr/bin/env node
const out = (event) => process.stdout.write(JSON.stringify(event) + '\\n');
out({ type: 'stream_event', event: { type: 'message_start' } });
let i = 0;
const timer = setInterval(() => {
  i += 1;
  out({ type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: i + '번째 줄이에요.\\n' } } });
  if (i === 40) {
    clearInterval(timer);
    out({ type: 'result', subtype: 'success', is_error: false, result: '' });
  }
}, 50);
`, { mode: 0o755 });
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
  window.until = async (ok, ms = 10000) => { for (let t = 0; t < ms && !ok(); t += 50) await wait(50); return ok(); };
  window.atBottom = (el) => el.scrollHeight - el.scrollTop - el.clientHeight <= 40;
  window.replies = () => $$('#chat-log .chat-bubble.pet:not(.thinking)').length;
  return true;`;

const checks = [];
// { reload: true } reloads the window (and its helpers) before the check.
const check = (name, body, expected, { reload = false } = {}) => checks.push({ name, body, expected, reload });

// ---- the scenario ----
check('panel opens on right click', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); return !$('#panel').hidden;`, true);
check('four groups, home first, none overflowing', `return $$('[data-group]').map((b) => b.textContent.trim() + (b.scrollWidth <= b.clientWidth ? '' : '!'));`, ['홈', '집중', '기록', '설정']);
check('pomodoro opens first', `return $('[data-module][aria-selected=true]').dataset.module;`, 'pomodoro');
check('arrow keys move between groups', `$('[data-group=focus]').focus(); key('[data-group=focus]', 'ArrowLeft'); await wait(150); const left = [$('[data-group][aria-selected=true]').dataset.group, $$('[data-group]').map((b) => b.tabIndex)]; key('[data-group=home]', 'ArrowLeft'); await wait(150); return [left, $('[data-group][aria-selected=true]').dataset.group];`, [['home', [0, -1, -1, -1]], 'settings']);

check('home: the board shows the default four widgets', `await open_('home'); return [$$('[data-module]').length, $$('[data-widget]').map((e) => e.dataset.widget), $$('[data-widget]').map((e) => e.getBoundingClientRect().width > 0)];`, [0, ['timer', 'todos', 'pinned', 'music'], [true, true, true, true]]);
check('home: empty widgets say so', `return [text('[data-pinned-empty]'), text('[data-todos-empty]'), text('[data-music-empty]'), text('[data-timer-digits]'), text('[data-timer-phase]')];`, ['고정한 메모가 없어요', '할 일이 비었어요', '재생 중인 음악이 없어요', '25:00', '대기']);
check('home: the timer widget starts and pauses the pomodoro', `$('[data-timer-action=start]').click(); await wait(2300); const running = [text('[data-timer-digits]').startsWith('24:5'), text('[data-timer-phase]'), $('[data-timer-action]').dataset.timerAction]; $('[data-timer-action=pause]').click(); await wait(300); const paused = $('[data-timer-action]').dataset.timerAction; await open_('focus', 'pomodoro'); const tab = text('#controls'); $$('#controls button')[1].click(); await wait(300); await open_('home'); return [running, paused, tab, text('[data-timer-digits]'), $('[data-timer-action]').dataset.timerAction];`, [[true, '집중', 'pause'], 'resume', '재개 그만두기', '25:00', 'start']);
check('home: remove a widget, and only it can be added back', `$('[aria-label="할 일 요약 설정"]').click(); await wait(100); $('[data-widget=todos] [data-widget-action=remove]').click(); await wait(200); const left = $$('[data-widget]').map((e) => e.dataset.widget); $('[data-widget-add]').click(); await wait(100); return [left, $$('[data-widget-add-menu] [data-add]').map((e) => e.dataset.add)];`, [['timer', 'pinned', 'music'], ['todos']]);
check('home: add a widget at the end and move one up', `$('[data-add=todos]').click(); await wait(200); const added = $$('[data-widget]').map((e) => e.dataset.widget); $('[aria-label="음악 설정"]').click(); await wait(100); const upDisabled = $('[data-widget=music] [data-widget-action=up]').disabled; $('[data-widget=music] [data-widget-action=up]').click(); await wait(200); return [added, upDisabled, $$('[data-widget]').map((e) => e.dataset.widget), $('[data-widget-add]').disabled];`, [['timer', 'pinned', 'music', 'todos'], false, ['timer', 'music', 'pinned', 'todos'], true]);
check('home: the layout is saved and survives closing the panel', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); const closed = $('#panel').hidden; $('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(); return [closed, $$('[data-widget]').map((e) => e.dataset.widget), await window.petApi.db.getKv('widgets.board')];`, [true, ['timer', 'music', 'pinned', 'todos'], '["timer","music","pinned","todos"]']);

check('todo: empty list', `await open_('focus', 'todo'); return text('#todo-open');`, '할 일이 비었어요');
check('todo: add with Enter', `type('#todo-input', '영어 단어'); key('#todo-input', 'Enter'); await wait(400); return [$('#todo-input').value, $$('#todo-open .todo-title').map((e) => e.textContent.trim())];`, ['', ['영어 단어']]);
check('todo: estimate stays within 1..12', `const [down, up] = $$('.estimate button'); down.click(); await wait(50); const low = text('#todo-estimate'); for (let i = 0; i < 15; i++) up.click(); await wait(50); return [low, text('#todo-estimate')];`, ['1', '12']);
check('todo: typed text survives a group switch', `type('#todo-input', '공부 중'); await open_('record'); await open_('focus'); return [$('#todo-input').value, $('[data-module][aria-selected=true]').dataset.module];`, ['공부 중', 'todo']);
check('todo: check off and clear', `type('#todo-input', ''); $('#todo-open .todo-check').click(); await wait(400); const done = $$('#todo-done .todo').length; $('#todo-done-title button').click(); await wait(400); return [text('#todo-open'), done, $$('#todo-done .todo').length];`, ['할 일이 비었어요', 1, 0]);
check('todo: a checked-off row pops into the done list', `type('#todo-input', '팝'); key('#todo-input', 'Enter'); await wait(400); $('#todo-open .todo-check').click(); let popped = false; for (let i = 0; i < 20 && !popped; i++) { await wait(25); popped = $$('#todo-done .todo.pop').length > 0; } $('#todo-done-title button').click(); await wait(300); return popped;`, true);
check('todo: filter opens', `$('#todo-funnel').click(); await wait(100); const shown = !$('#todo-filter').hidden; $('#todo-funnel').click(); return shown;`, true);

check('pomodoro: idle', `await open_('focus', 'pomodoro'); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작']);
check('pomodoro: start ticks', `$('#controls .primary').click(); await wait(2300); return [text('#digits') !== '25:00' && text('#digits').startsWith('24:5'), text('#controls')];`, [true, '일시정지 그만두기']);
check('pomodoro: pause holds', `$('#controls .primary').click(); await wait(300); const a = text('#digits'); await wait(1200); return [a === text('#digits'), $('#digits').classList.contains('paused'), text('#controls')];`, [true, true, '재개 그만두기']);
check('pomodoro: abandon resets', `$$('#controls button')[1].click(); await wait(300); return [text('#digits'), text('#controls')];`, ['25:00', '집중 시작']);

check('notes: empty list', `await open_('record', 'notes'); return text('#note-list');`, '첫 메모를 남겨보세요');
check('notes: new note opens the editor', `$('#note-browser .primary').click(); await wait(500); const t = $('#note-title'); return [$('#note-editor').hidden, t.value, t.selectionStart === 0 && t.selectionEnd === t.value.length];`, [false, '새 메모', true]);
check('notes: autosave', `type('#note-body', '미적분 정리'); await wait(900); return text('#note-status');`, '저장됨');
check('notes: pin, back, search, delete', `$('#note-pin').click(); await wait(400); const pin = text('#note-pin'); $('#note-editor .ghost').click(); await wait(200); const list = text('#note-list'); type('#note-search', '없는말'); await wait(400); const none = text('#note-list'); type('#note-search', ''); await wait(400); $('.note-card').click(); await wait(200); $('[aria-label="메모 삭제"]').click(); await wait(400); return [pin, list.startsWith('고정1개 새 메모'), none, text('#note-list')];`, ['고정됨', true, '검색 결과가 없어요', '첫 메모를 남겨보세요']);

check('music: no lists yet', `await open_('focus', 'playlist'); return [text('#items'), text('#list-select')];`, ['위에서 새 플레이리스트를 만들어보세요', '플레이리스트 없음']);
check('music: new list with Enter', `type('#new-list', '집중 음악'); key('#new-list', 'Enter'); await wait(400); return [$('#new-list').value, text('#list-select'), text('#items'), $$('#focus-list option').map((o) => o.textContent)];`, ['', '집중 음악', '곡을 추가해보세요', ['(없음 · 이어서 재생/일시정지)', '집중 음악 (0)']]);
check('music: timer sync is saved', `$('#sync').click(); await wait(300); return $('#sync').checked;`, true);
check('music: a wrong link is refused', `$('details.external').open = true; type('#link', 'https://example.com'); key('#link', 'Enter'); await wait(200); return text('#playlist-hint');`, 'Spotify 트랙/앨범/플레이리스트 링크만 지원해요');
check('music: delete the list', `$('[aria-label="목록 삭제"]').click(); await wait(400); return text('#items');`, '위에서 새 플레이리스트를 만들어보세요');
check('notes: editing a note found by search keeps the editor open', `await open_('record', 'notes'); $('#note-browser .primary').click(); await wait(500); type('#note-title', '미분'); await wait(800); $('#note-editor .ghost').click(); await wait(200); type('#note-search', '미분'); await wait(400); $('.note-card').click(); await wait(200); type('#note-title', '적분'); await wait(900); const open = !$('#note-editor').hidden; $('[aria-label="메모 삭제"]').click(); await wait(300); type('#note-search', ''); await wait(300); return [open, text('#note-list')];`, [true, '첫 메모를 남겨보세요']);
check('dashboard: tiles and empty log', `await open_('record', 'dashboard'); await wait(900); return [$$('#tiles .tile').length, text('#tile-today'), text('#tile-rate'), text('#log')];`, [4, '0m', '0%', '첫 뽀모도로를 끝내면 여기에 기록돼요']);
check('dashboard: charts drawn', `return ['#week', '#hours', '#heat'].map((s) => $(s + ' svg') !== null);`, [true, true, true]);
check('dashboard: log filter opens', `$('#log-funnel').click(); await wait(100); const shown = !$('#log-filter').hidden; $('#log-funnel').click(); return shown;`, true);

check('characters: main pet stays, friends can be called', `await open_('settings', 'friends'); await wait(400); return [text('#friends-count'), $$('#friends-list li').length >= 3, text('#friends-list li:first-child').includes('대표') || $$('#friends-list .hint').some((e) => e.textContent === '대표'), $('#friends-clear').disabled];`, ['화면에 1마리', true, true, true]);
check('characters: call a friend out and send everyone back', `$('#friends-list button.mini:not(.ghost)').click(); await wait(1500); const called = text('#friends-count'); $('#friends-clear').click(); await wait(1200); return [called, text('#friends-count')];`, ['화면에 2마리', '화면에 1마리']);
check('settings: steppers change and save', `await open_('settings', 'settings'); await wait(300); const before = text('#out-focusMinutes'); $('#out-focusMinutes').nextElementSibling.click(); await wait(400); const after = text('#out-focusMinutes'); $('#out-focusMinutes').previousElementSibling.click(); await wait(400); return [before, after, text('#out-focusMinutes'), text('#out-petScale')];`, ['25분', '30분', '25분', '2배']);
check('settings: a toggle saves', `const box = $('[data-bool=autoStartFocus]'); const was = box.checked; box.click(); await wait(400); const now = box.checked; box.click(); await wait(400); return [now === !was, box.checked === was];`, [true, true]);
check('settings: chat shortcut toggle is under 펫 and off', `const box = $('[data-bool=chatShortcut]'); const group = box?.closest('.setting-group')?.previousElementSibling; return [box !== null, group?.textContent.trim(), box?.checked, (await window.petApi.db.getSettings()).chatShortcut];`, [true, '펫', false, false]);
check('settings: chat shortcut toggle saves', `const box = $('[data-bool=chatShortcut]'); box.click(); await wait(400); const on = [box.checked, (await window.petApi.db.getSettings()).chatShortcut]; box.click(); await wait(400); return [on, box.checked, (await window.petApi.db.getSettings()).chatShortcut];`, [[true, true], false, false]);
check('settings: character list and dress-up', `return [$$('#character-select option').length >= 3, $('#character-select').value, $$('#dressup .slot-row').length > 0];`, [true, 'lila', true]);
check('settings: every outfit can be chosen (no unlocks)', `return [$$('#dressup .swatch').length > 0, $$('#dressup .swatch[disabled]').length, text('#dressup').includes('잠김')];`, [true, 0, false]);
check('dashboard: no unlock bar', `await open_('record', 'dashboard'); await wait(300); const bars = $$('#stat-bars .bar-row span:first-child').map((s) => s.textContent); await open_('settings', 'settings'); return bars.includes('해금');`, false);
check('settings: nickname saves', `type('#nickname', '민'); $('#nickname').dispatchEvent(new Event('change', { bubbles: true })); await wait(400); return $('#nickname').value;`, '민');
check('settings: backup and MCP sections', `await wait(500); return [$$('#backup-box button').length, text('#mcp-box').includes('Claude Code')];`, [2, true]);
check('settings: AI page opens over the list and goes back', `$('#ai-open').click(); await wait(400); const open = [!$('#ai-page').hidden, getComputedStyle($('#nickname')).display === 'none' || $('#nickname').offsetParent === null]; $('#ai-page [data-action=ai-back]').click(); await wait(300); return [open, $('#ai-page').hidden];`, [[true, true], true]);
check('settings: backup buttons, no confirm step yet', `return [$$('#backup-box > .row button').map((b) => b.textContent.trim() + (b.disabled ? '!' : '')), $('#backup-confirm').hidden, $$('#backup-confirm button').length, text('#backup-status').startsWith('할 일·메모')];`, [['내보내기(JSON)', '가져오기(JSON)'], true, 0, true]);
check('settings: AI page lists providers and tools', `$('#ai-open').click(); await wait(500); return [$$('#ai-providers .ai-provider').length, $$('#ai-providers .ai-provider.selected').length, $$('#ai-providers input[name=ai-provider]:checked').length, $$('#ai-tool-list .ai-tool').length > 0];`, [6, 1, 1, true]);
check('settings: AI profile fields save', `const c = $('#ai-call'); c.value = '선생님'; c.dispatchEvent(new Event('change', { bubbles: true })); await wait(300); const long = $('[data-length=long]'); long.click(); await wait(300); const saved = [text('#ai-preview').includes('선생님'), long.getAttribute('aria-pressed'), $('[data-length=short]').getAttribute('aria-pressed')]; $('[data-action=profile-reset]').click(); await wait(300); return [saved, $('#ai-call').value, $('[data-length=short]').getAttribute('aria-pressed')];`, [[true, 'true', 'false'], '', 'true']);
check('settings: clearing every conversation asks first', `const b = $('#ai-clear'); const before = text('#ai-sessions'); b.click(); await wait(100); const asked = [b.textContent, text('#ai-sessions') === before]; b.click(); await wait(300); return [asked, b.textContent, text('#ai-sessions')];`, [['정말 모두 지울까요?', true], '모든 대화 지우기', '저장된 대화 0개']);
check('settings: AI page back returns to the list', `$('#ai-page [data-action=ai-back]').click(); await wait(300); return [$('#ai-page').hidden, $('#nickname').offsetParent !== null];`, [true, true]);
check('settings: troubleshooting buttons', `await open_('settings', 'settings'); return [$('#open-logs') !== null, text('#copy-diagnostics')];`, [true, '진단 정보 복사']);
check('diagnostics: versions, no secrets', `window.petApi.log('error', 'check', 'token Bearer abcdefghijklmnopqrstuvwxyz0123 sk-ant-abcdefghij12345'); await wait(300); const d = await window.petApi.diagnostics(); return [d.startsWith('petnudge '), d.includes('ERROR [check]'), /Bearer [A-Za-z0-9]{8}|sk-ant-/.test(d)];`, [true, true, false]);
check('every tab renders without falling back', `return $$('[data-failed]').length;`, 0);
check('chat: 크게 보기 opens 기록 › 대화', `$('#chat-quick-full').click(); await wait(200); return [$('[data-group][aria-selected=true]').dataset.group, $('[data-module][aria-selected=true]').dataset.module];`, ['record', 'chat']);
check('chat: 크게 보기 shows her current conversation', `return [$('#chat-session-view').hidden, text('#chat-log').includes('말을 걸어 봐요'), $('#chat-input') !== null];`, [false, true, true]);
check('chat: back to the friend list, pet unfolded', `$('[aria-label="목록으로"]').click(); await wait(300); return [$('#chat-list-view').hidden, $('.chat-friend.open .chat-friend-name').textContent.includes('지금 펫'), $$('.chat-friend').length >= 3];`, [false, true, true]);
check('chat: the pet stays folded when folded', `const head = $('.chat-friend.open .chat-friend-head'); head.click(); await wait(300); const folded = $$('.chat-friend.open').length === 0; head.click(); await wait(300); return [folded, $$('.chat-friend.open').length];`, [true, 1]);
check('chat: a sent line shows in the conversation', `$('.chat-friend.open .chat-new').click(); await wait(300); type('#chat-input', '안녕'); key('#chat-input', 'Enter'); await wait(800); const shown = $$('#chat-log .chat-bubble.user').map((b) => b.textContent.trim()); const title = $('#chat-title-input').value; $('[aria-label="목록으로"]').click(); await wait(300); return [shown, title, text('.chat-friend.open .chat-session').includes('안녕')];`, [['안녕'], '안녕', true]);
check('chat: new conversation, rename, delete with a second press', `$('.chat-friend.open .chat-new').click(); await wait(300); const t = $('#chat-title-input'); t.value = '수학 질문'; t.dispatchEvent(new Event('change', { bubbles: true })); await wait(200); $('[aria-label="목록으로"]').click(); await wait(300); const titles = $$('.chat-friend.open .chat-session b').map((b) => b.textContent); const before = $$('.chat-friend.open .chat-session-row').length; const del = () => $$('.chat-friend.open .chat-session-row').find((r) => r.textContent.includes('수학 질문')).querySelector('[aria-label="대화 삭제"]'); del().click(); await wait(100); const asked = del().textContent; del().click(); await wait(300); return [titles.includes('수학 질문'), asked, $$('.chat-friend.open .chat-session-row').length === before - 1];`, [true, '?', true]);
check('chat: a streamed reply follows the bottom', `$('.chat-friend.open .chat-new').click(); await wait(300); await until(() => !$('#chat-input').disabled); type('#chat-input', '길게 말해 줘'); key('#chat-input', 'Enter'); const log = $('#chat-log'); await until(() => replies() === 1); await wait(1200); const mid = [text('#chat-send'), log.scrollHeight > log.clientHeight, atBottom(log)]; await until(() => text('#chat-send') === '보내기'); await wait(100); return [mid, atBottom(log), $('#chat-new-below') === null];`, [['멈춤', true, true], true, true]);
check('chat: scrolled up, a streamed reply keeps the place and offers 새 메시지 ↓', `type('#chat-input', '또'); key('#chat-input', 'Enter'); const log = $('#chat-log'); await until(() => replies() === 2); log.scrollTop = 0; await wait(150); const height = log.scrollHeight; await wait(600); return [text('#chat-send'), log.scrollTop, log.scrollHeight > height, text('#chat-new-below')];`, ['멈춤', 0, true, '새 메시지 ↓']);
check('chat: 새 메시지 ↓ goes to the bottom and follows again', `const log = $('#chat-log'); $('#chat-new-below').click(); await wait(150); const jumped = [atBottom(log), $('#chat-new-below') === null]; await until(() => text('#chat-send') === '보내기'); await wait(100); const done = [atBottom(log), $('#chat-new-below') === null, replies()]; $('[aria-label="목록으로"]').click(); await wait(300); return [jumped, done];`, [[true, true], [true, true, 2]]);
check('settings: quit button under settings', `await open_('settings'); return $('[data-quit]') !== null;`, true);
check('panel: 220px keeps both tab rows', `$('#panel').style.setProperty('--panel-height', '220px'); await wait(100); const p = $('#panel').getBoundingClientRect(), s = $('.ui-tabs.sub').getBoundingClientRect(); $('#panel').style.removeProperty('--panel-height'); return s.height > 0 && s.bottom <= p.bottom;`, true);
check('home: opened last, so it is saved as the module to reopen', `await open_('home'); return $('[data-group][aria-selected=true]').dataset.group;`, 'home');
check('home: the saved layout is restored after a reload', `$('#pet').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })); await wait(600); return [$('[data-group][aria-selected=true]').dataset.group, $$('[data-widget]').map((e) => e.dataset.widget)];`, ['home', ['timer', 'music', 'pinned', 'todos']], { reload: true });

// ---- run ----
let failed = 0;
try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.reload');
  await sleep(2500);
  await run(HELPERS);
  for (const { name, body, expected, reload } of checks) {
    current = name;
    let actual;
    try {
      if (reload) {
        await send('Page.reload');
        await sleep(2500);
        await run(HELPERS);
      }
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
