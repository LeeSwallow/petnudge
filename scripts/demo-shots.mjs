// Screenshots for the README, from a throwaway profile so your own data is
// never shown: node scripts/demo-shots.mjs [outDir]
// Builds, starts the app with PETNUDGE_PROFILE in a temp folder, fills it with
// sample todos, focus sessions and notes, opens each panel tab and saves the
// window as a transparent PNG (Chrome DevTools Protocol, any OS).
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'docs/images');
const port = 9339;
const profile = mkdtempSync(path.join(tmpdir(), 'petnudge-demo-'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

execFileSync('node', ['build.mjs'], { stdio: 'inherit' });
// The electron package exports the path of its binary, on every OS.
const electron = createRequire(import.meta.url)('electron');
const app = spawn(electron, ['.', `--remote-debugging-port=${port}`], {
  env: { ...process.env, PETNUDGE_PROFILE: profile },
  stdio: 'ignore'
});
let launchError = null;
app.on('error', (error) => (launchError = error));

const target = async () => {
  for (let i = 0; i < 40; i++) {
    if (launchError) throw launchError;
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === 'page' && t.url.endsWith('index.html'));
      if (page) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error('the app did not open a debuggable window');
};

const connect = async (url) => {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  let next = 0;
  const pending = new Map();
  ws.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    pending.get(data.id)?.(data);
    pending.delete(data.id);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      pending.set(id, (data) => (data.error ? reject(new Error(data.error.message)) : resolve(data.result)));
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };
  return { ws, send, evaluate };
};

const day = (offset, hour) => {
  const date = new Date();
  date.setDate(date.getDate() - offset);
  date.setHours(hour, 10, 0, 0);
  return date;
};
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const sessions = [];
for (let offset = 6; offset >= 0; offset--) {
  const count = [2, 3, 1, 4, 3, 2, 3][offset];
  for (let i = 0; i < count; i++) {
    const end = day(offset, 9 + i * 2 + (offset % 3));
    sessions.push({ todoId: null, startedAt: end.getTime() - 25 * 60_000, endedAt: end.getTime(), plannedMinutes: 25, actualMinutes: 25, pauseCount: 0, completed: true, dateKey: dateKey(end), hour: end.getHours() });
  }
}

const seed = `(async () => {
  const db = window.petApi.db;
  // A fresh profile must start empty; anything here would be someone's real data.
  const [todos0, sessions0, notes0] = await Promise.all([db.listTodos(), db.listSessions(), db.listNotes()]);
  if (todos0.length || sessions0.length || notes0.length) throw new Error('the demo profile is not empty');
  const todos = [['3단원 문제 풀기', 3], ['강의 노트 복습', 2], ['스터디 단톡 답장', 1], ['영단어 40개 외우기', 2]];
  const added = [];
  for (const [title, estimate] of todos) added.push(await db.addTodo(title, estimate));
  await db.setTodoDone(added[2].id, true);
  for (const session of ${JSON.stringify(sessions)}) await db.recordFocusSession(session);
  await db.createNote('시험 계획', '- 월: 3단원\\n- 수: 모의고사\\n- 금: 오답 정리');
  return 'seeded';
})()`;

try {
  mkdirSync(out, { recursive: true });
  let page = await target();
  let { ws, evaluate } = await connect(page.webSocketDebuggerUrl);
  await evaluate(seed);
  await evaluate('location.reload(); true');
  ws.close();
  await sleep(2500);
  page = await target();
  let send;
  ({ ws, evaluate, send } = await connect(page.webSocketDebuggerUrl));
  await send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
  // The pets on their own: the main one and each built-in character as a friend.
  const shoot = async (url, name) => {
    const pet = await connect(url);
    await pet.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    // The pet alone: no speech bubble (the greeting would be in one shot only).
    await pet.evaluate("document.getElementById('bubble').style.visibility = 'hidden'; true");
    const shot = await pet.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(out, `pet-${name}.png`), Buffer.from(shot.data, 'base64'));
    pet.ws.close();
    console.log(`saved pet-${name}.png`);
  };
  const ids = await evaluate('window.petApi.listCharacters().then((list) => list.map((c) => c.id))');
  for (const id of ids.filter((id) => id !== 'lila')) await evaluate(`window.petApi.openFriend('${id}')`);
  await sleep(2500);
  await shoot(page.webSocketDebuggerUrl, 'lila');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  for (const friend of pages.filter((t) => t.type === 'page' && t.url.includes('friend='))) {
    await shoot(friend.webSocketDebuggerUrl, new URL(friend.url).searchParams.get('friend'));
  }
  await evaluate('window.petApi.closeFriend(); true');
  await evaluate("document.querySelector('canvas').dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true })); true");
  await sleep(800);
  for (const tab of ['todo', 'pomodoro', 'dashboard', 'settings']) {
    await evaluate(`document.querySelector('[data-module=${tab}]').click(); true`);
    await sleep(900);
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(out, `panel-${tab}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`saved panel-${tab}.png`);
  }
  ws.close();
} finally {
  app.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true });
}
