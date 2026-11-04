import { toDateKey } from '../domain/progress/progress';
import { getRemainingMs, type TimerState } from '../domain/pomodoro/timer';
import { api } from './api';
import { data, onData, refreshAll, refreshNotes, refreshSettings, refreshStats, refreshTodos, type DataKind } from './data';
import { confetti, enter, pop } from './fx';
import { onOpenChat, startChat } from './chat';
import { installChatBar } from './pet/chatbar';
import { nearestFriend, onNearChange, startFriends } from './pet/friends';
import { holdStill, pauseWalking } from './pet/behavior';
import { sayLine } from './pet/bubble';
import { faceToward } from './pet/gaze';
import { handleModeChange, handleNowPlaying, music, onMusic } from './music';
import { installPetInput, isDragging, markActivity, react, renderBubble, resizePet, startPetLoop } from './pet';
import { cancelMods, emit as emitMod } from './pet/mods';
import { petStore, whenHydrated } from './store';
import { installTooltip } from './tooltip';
import { characterReady, pack, setCharacter } from './character';
import { createPanel, type PanelController } from '../ui/panel/controller';
import type { Cause } from '../ui/state/bridge';
import { restoreModule } from '../ui/panel/groups';
import type { ModuleId } from '../ui/modules/module';
import { MODULES } from '../ui/modules/registry';
import { showActiveSession, showSession } from '../ui/modules/chat';
import { bump } from '../ui/state/revision.svelte';
import { installTokens } from '../ui/theme/install';
import { installErrorLogging, logError } from '../ui/log';
import { mountDock, type DockController } from '../ui/dock/mount';

const TRANSITION_STEP_MS = 1200;

const panel = document.getElementById('panel')!;
let panelUi: PanelController | null = null;
let dock: DockController | null = null;

const visible = () => !panel.hidden;

// Svelte modules follow these counters (src/ui/state).
const renderActive = (cause: Cause) => bump(cause);
const showModule = (id: ModuleId, animate = true) => panelUi?.show(id, animate);

const togglePanel = () => {
  panel.hidden = !panel.hidden;
  if (!panel.hidden) cancelMods();
  emitMod(panel.hidden ? 'panelClose' : 'panelOpen', 'after');
  api.setPanelOpen(visible());
  dock?.setPanelOpen(visible());
  if (visible()) bump('shown');
  renderBubble(visible());
};

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
  });
};

// ---------- window layout (main/layout.ts places the window) ----------

const installLayoutSync = () => {
  const petArea = document.getElementById('pet-area')!;
  const pet = document.getElementById('pet')!;
  const report = () => api.reportPetLayout({ petAreaHeight: petArea.offsetHeight, petWidth: pet.offsetWidth });
  new ResizeObserver(report).observe(petArea);
  api.onLayout(({ below, petDx, panelHeight }) => {
    dock?.setLayout(petDx, pet.offsetWidth);
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
  installErrorLogging();
  installTokens();
  installTooltip();
  await Promise.all([refreshAll(), whenHydrated(), characterReady]);
  try {
    await setCharacter(await api.getCharacter(data.settings.characterId));
  } catch (error) {
    logError('character', error, 'warn'); // falls back to the default character
    data.settings = await api.db.updateSettings({ characterId: 'lila' });
  }
  api.onCharacterChanged(async (id) => {
    if (id !== data.settings.characterId) return;
    try {
      await setCharacter(await api.getCharacter(id));
    } catch (error) {
      logError('character:reload', error, 'warn');
    }
  });
  petStore.getState().applySettings(data.settings);
  music.setVolume(data.settings.musicVolume);

  panelUi = createPanel(panel, MODULES, {
    onQuit: () => api.quit(),
    onShow: (id, body, tab, animate) => {
      bump('shown');
      void api.db.setKv('ui.module', id);
      tab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      if (animate) {
        if (tab) pop(tab);
        enter(body, 'settle');
      }
    }
  });
  panelUi.show(restoreModule(MODULES, (await api.db.getKv('ui.module')) as string | null), false);

  onData((kind) => {
    if (kind === 'settings') {
      petStore.getState().applySettings(data.settings);
      music.setVolume(data.settings.musicVolume);
      resizePet();
    }
    renderActive(kind);
  });
  onMusic(() => renderActive('music'));
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

  // The dock beside her (src/ui/dock): the talk button and a few widgets.
  const petArea = document.getElementById('pet-area')!;
  const petUnit = document.getElementById('pet-unit')!;
  const canvas = document.getElementById('pet')!;
  dock = mountDock(document.getElementById('pet-body')!, {
    windowWidth: window.innerWidth,
    onhover: pauseWalking,
    onheight: (px) => {
      // the window keeps room for a dock taller than she is, and what is over
      // her head (bubble, quick chat) stays as narrow as she is beside it
      petArea.style.minHeight = px > 0 ? `${px}px` : '';
      if (px > canvas.offsetHeight) petUnit.style.setProperty('--head-width', `${canvas.offsetWidth}px`);
      else petUnit.style.removeProperty('--head-width');
    }
  });
  onNearChange(() => dock?.setFriend(nearestFriend()?.dx ?? null));

  watchSession();
  installClickThrough();
  installLayoutSync();
  installPetInput(togglePanel);
  startFriends();
  // 기록 › 대화 on a conversation: the quick bar's 크게 보기 (her current one)
  // and a bubble's "더 보기 ▸", hers or a friend's (the one the line is from).
  const openChat = (sessionId?: string) => {
    if (sessionId) showSession(sessionId);
    else showActiveSession();
    if (!visible()) togglePanel();
    showModule('chat');
  };
  onOpenChat(openChat);
  api.onOpenChatSession(openChat);
  const chatBar = installChatBar(() => openChat(), document.getElementById('dock-talk')!);
  // The tray menu and the chat shortcut (main/tray.ts, main.ts).
  api.onTogglePanel(togglePanel);
  api.onOpenQuickChat(chatBar.openInput);
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
    // the pomodoro tab, the home board's timer widget and the dock show the clock
    const active = panelUi?.active();
    if (!visible() || active === 'pomodoro' || active === 'home') bump('clock');
    renderBubble(visible());
  }, 250);

  renderBubble(false);
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
  api.onFriendSay((text, ms, sessionId) => {
    sayLine(text, { holdMs: ms, onMore: sessionId ? () => api.openChatSession(sessionId) : undefined });
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
