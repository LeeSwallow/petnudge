import { toDateKey } from '../domain/progress/progress';
import { getRemainingMs, type TimerState } from '../domain/pomodoro/timer';
import { api } from './api';
import { data, onData, refreshAll, refreshNotes, refreshSettings, refreshStats, refreshTodos, type DataKind } from './data';
import { confetti, enter, pop } from './fx';
import { chatModule, showActiveSession } from './modules/chat';
import { startChat } from './chat';
import { installChatBar } from './pet/chatbar';
import { startFriends } from './pet/friends';
import { holdStill } from './pet/behavior';
import { sayNow } from './pet/bubble';
import { faceToward } from './pet/gaze';
import { dashboardModule } from './modules/dashboard';
import { friendsModule } from './modules/friends';
import type { ModuleId, PanelModule } from './modules/module';
import { notesModule } from './modules/notes';
import { playlistModule } from './modules/playlist';
import { pomodoroModule, renderPomodoroClock } from './modules/pomodoro';
import { settingsModule } from './modules/settings';
import { todoModule } from './modules/todo';
import { handleModeChange, handleNowPlaying, music, onMusic } from './music';
import { installPetInput, isDragging, markActivity, react, renderBubble, resizePet, startPetLoop } from './pet';
import { cancelMods, emit as emitMod } from './pet/mods';
import { petStore, whenHydrated } from './store';
import { installTooltip } from './tooltip';
import { pixelIcon } from './icons';
import { characterReady, pack, setCharacter } from './character';
import { createPanel, type PanelController, type RenderCause } from '../ui/panel/controller';
import { restoreModule } from '../ui/panel/groups';
import { installTokens } from '../ui/theme/install';

const TRANSITION_STEP_MS = 1200;
const MODULES: PanelModule[] = [todoModule, pomodoroModule, dashboardModule, playlistModule, notesModule, chatModule, friendsModule, settingsModule];

const panel = document.getElementById('panel')!;
let panelUi: PanelController | null = null;

const visible = () => !panel.hidden;

const renderActive = (cause: RenderCause) => panelUi?.render(cause);
const showModule = (id: ModuleId, animate = true) => panelUi?.show(id, animate);

const togglePanel = () => {
  panel.hidden = !panel.hidden;
  if (!panel.hidden) cancelMods();
  emitMod(panel.hidden ? 'panelClose' : 'panelOpen', 'after');
  api.setPanelOpen(visible());
  if (visible()) panelUi?.refresh();
  renderBubble(visible());
};

// ---------- now-playing strip ----------

const strip = document.getElementById('player-strip')!;
const renderStrip = () => {
  const track = music.nowPlaying;
  strip.hidden = !track;
  if (!track) return;
  const queueList = music.queue ? data.playlists.find((p) => p.id === music.queue!.playlistId) : null;
  const badge = document.getElementById('player-badge')!;
  const mode = petStore.getState().timer.mode;
  badge.textContent = queueList ? queueList.name : track.player === 'Local' ? '내 음악' : track.player.toUpperCase();
  badge.className = `badge ${queueList ? (mode === 'break' ? 'break' : 'focus') : ''}`;
  const title = document.getElementById('player-title')!;
  const label = `${track.title}${track.artist ? ` — ${track.artist}` : ''}`;
  if (title.textContent !== label) {
    title.textContent = label;
    title.classList.toggle('scroll', label.length > 26);
  }
  const toggle = document.getElementById('player-toggle')!;
  toggle.innerHTML = pixelIcon(track.state === 'playing' ? 'pause' : 'play');
  toggle.setAttribute('aria-label', track.state === 'playing' ? '일시정지' : '재생');
};
document.getElementById('player-toggle')!.addEventListener('click', () => void music.toggle());
document.getElementById('player-next')!.addEventListener('click', () => void music.next());

// ---------- session bookkeeping on timer transitions ----------

const recordFocus = async (timer: TimerState, completed: boolean, pauseCount: number, todoId: string | null) => {
  if (timer.startedAt === null || timer.endsAt === null) return;
  const planned = data.settings.focusMinutes;
  const endedAt = completed ? timer.endsAt : Date.now();
  const actual = completed ? planned : Math.round((planned * 60_000 - getRemainingMs(timer, endedAt)) / 60_000);
  if (!completed && actual < 1) return;
  const end = new Date(endedAt);
  await api.db.recordFocusSession({
    todoId,
    startedAt: timer.startedAt,
    endedAt,
    plannedMinutes: planned,
    actualMinutes: actual,
    completed,
    pauseCount,
    dateKey: toDateKey(end),
    hour: end.getHours()
  });
  await Promise.all([refreshStats(), refreshTodos()]);
};

const watchSession = () => {
  petStore.subscribe((state, previous) => {
    const before = previous.timer.mode;
    const after = state.timer.mode;
    if (before !== after) {
      void handleModeChange(before, after);
      if (before === 'focus' && after === 'break') {
        void recordFocus(previous.timer, true, previous.pauseCount, previous.activeTodoId);
        react('celebrate', 2500);
        const tab = panel.querySelector('[data-module="pomodoro"]') ?? panel.querySelector('[data-group="focus"]');
        if (tab) void confetti(tab);
      }
      if (before === 'focus' && after === 'idle') void recordFocus(previous.timer, false, previous.pauseCount, previous.activeTodoId);
      if (before === 'break' && after === 'idle' && data.settings.autoStartFocus) state.startFocus();
      const ring = document.getElementById('ring');
      if (visible() && ring) pop(ring);
      markActivity();
    }
    renderActive('session');
    renderBubble(visible());
    renderStrip();
  });
};

// ---------- window layout (main/layout.ts places the window) ----------

const installLayoutSync = () => {
  const petArea = document.getElementById('pet-area')!;
  const pet = document.getElementById('pet')!;
  const report = () => api.reportPetLayout({ petAreaHeight: petArea.offsetHeight, petWidth: pet.offsetWidth });
  new ResizeObserver(report).observe(petArea);
  api.onLayout(({ below, petDx, panelHeight }) => {
    document.body.classList.toggle('below', below);
    document.body.style.setProperty('--pet-dx', `${petDx}px`);
    document.body.style.setProperty('--panel-height', panelHeight > 0 ? `${panelHeight}px` : 'none');
  });
  report();
};

// ---------- click-through for transparent pixels ----------

const installClickThrough = () => {
  let ignoring = true;
  document.addEventListener('mousemove', (event) => {
    const overUi = event.target instanceof Element && event.target.closest('[data-hit]') !== null;
    const ignore = !overUi && !isDragging();
    if (ignore === ignoring) return;
    ignoring = ignore;
    api.setIgnoreMouse(ignore);
  });
};

// ---------- boot ----------

const boot = async () => {
  installTokens();
  document.getElementById('player-next')!.innerHTML = pixelIcon('next');
  installTooltip();
  await Promise.all([refreshAll(), whenHydrated(), characterReady]);
  try {
    await setCharacter(await api.getCharacter(data.settings.characterId));
  } catch (error) {
    console.error('캐릭터를 불러오지 못해 기본 캐릭터를 사용합니다', error);
    data.settings = await api.db.updateSettings({ characterId: 'lila' });
  }
  api.onCharacterChanged(async (id) => {
    if (id !== data.settings.characterId) return;
    try {
      await setCharacter(await api.getCharacter(id));
    } catch (error) {
      console.error('다시 내보낸 캐릭터를 불러오지 못했어요', error);
    }
  });
  petStore.getState().applySettings(data.settings);
  music.setVolume(data.settings.musicVolume);

  panelUi = createPanel(panel, MODULES, {
    visible,
    onQuit: () => api.quit(),
    onShow: (id, body, tab, animate) => {
      void api.db.setKv('ui.module', id);
      tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (animate) {
        if (tab) pop(tab);
        enter(body, 'settle');
      }
    }
  });
  panelUi.show(restoreModule((await api.db.getKv('ui.module')) as string | null), false);

  onData((kind) => {
    if (kind === 'settings') {
      petStore.getState().applySettings(data.settings);
      music.setVolume(data.settings.musicVolume);
      resizePet();
    }
    renderActive(kind);
  });
  onMusic(() => {
    renderStrip();
    renderActive('music');
  });
  api.onNowPlaying((nowPlaying) => void handleNowPlaying(nowPlaying));

  // Commands and edits coming from AI assistants over MCP.
  api.onTimerCommand((command) => {
    const store = petStore.getState();
    const { mode, pausedAt } = store.timer;
    if (command === 'start' && mode !== 'focus') store.startFocus();
    if (command === 'stop' && mode === 'focus') store.abandonFocus();
    if (command === 'pause' && mode !== 'idle' && pausedAt == null) store.togglePause();
    if (command === 'resume' && pausedAt != null) store.togglePause();
    react('heart', 900);
  });
  api.onDataChanged((kind) => {
    if (kind === 'todos') void refreshTodos();
    if (kind === 'notes') void refreshNotes();
    if (kind === 'stats') void refreshStats();
    if (kind === 'settings') void refreshSettings();
  });

  watchSession();
  installClickThrough();
  installLayoutSync();
  installPetInput(togglePanel);
  startFriends();
  installChatBar(() => {
    showActiveSession();
    if (!visible()) togglePanel();
    showModule('chat');
  });
  void startChat();
  startPetLoop();

  let lockedSince: number | null = null;
  setInterval(() => {
    const now = Date.now();
    const state = petStore.getState();
    state.tick(now);
    if (state.scene.inputLocked) {
      lockedSince ??= now;
      if (now - lockedSince >= TRANSITION_STEP_MS) {
        lockedSince = null;
        state.advanceTransition();
      }
    } else {
      lockedSince = null;
    }
    if (data.todayKey !== toDateKey(new Date(now))) void refreshStats();
    if (visible() && panelUi?.active() === 'pomodoro') renderPomodoroClock();
    renderBubble(visible());
  }, 250);

  renderBubble(false);
  renderStrip();
};

// A friend pet window (main/friends.ts): just the character, wandering and
// talking when the main pet's chat gives it a line.
const bootFriend = async (id: string) => {
  document.body.classList.add('friend-mode');
  await refreshSettings();
  // Follows the main window's timer (no wandering during focus), read-only.
  setInterval(() => void petStore.persist.rehydrate(), 5000);
  await setCharacter(await api.getCharacter(id));
  installClickThrough();
  installLayoutSync();
  installPetInput(() => {});
  startPetLoop();
  const bubble = document.getElementById('bubble')!;
  let clear: ReturnType<typeof setTimeout> | undefined;
  api.onFriendSay((text, ms) => {
    sayNow(text, ms);
    clearTimeout(clear);
    clear = setTimeout(() => (bubble.textContent = ''), ms + text.length * 60);
  });
  api.onFriendHold((ms, dx) => {
    holdStill(ms);
    faceToward(dx, ms);
  });
  api.onFriendNear(({ near, dx }) => { if (near) faceToward(dx, 1500); });
};

if (api.friendId) void bootFriend(api.friendId);
else void boot();
