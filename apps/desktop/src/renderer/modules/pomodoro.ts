import { formatRemaining, getRemainingMs, getTimerProgress, isTimerPaused, type TimerState } from '../../../../mobile/src/domain/timer';
import { esc, progressRing, tomatoRow } from '../charts';
import { api } from '../api';
import { data, refreshStats } from '../data';
import { formatMinutes } from '../../shared/stats';
import { petStore } from '../store';
import { $, onAction, onEnter, type PanelModule } from './module';
import { pixelIcon, moodIcons, moodLabels } from '../icons';

let root: HTMLElement;
let mood: number | null = null;
let reflectionShown = false;

export type PhaseKind = 'idle' | 'focus' | 'break' | 'long';

export const phaseOf = (timer: TimerState): PhaseKind => {
  if (timer.mode !== 'break') return timer.mode;
  const minutes = timer.startedAt !== null && timer.endsAt !== null ? (timer.endsAt - timer.startedAt) / 60_000 : 0;
  const { breakMinutes, longBreakMinutes } = data.settings;
  return longBreakMinutes !== breakMinutes && Math.round(minutes) === longBreakMinutes ? 'long' : 'break';
};

export const PHASE_COLOR: Record<PhaseKind, string> = {
  idle: 'var(--edge-hi)',
  focus: 'var(--focus)',
  break: 'var(--break)',
  long: 'var(--long)'
};

const renderClock = () => {
  const { timer, activeTodoId } = petStore.getState();
  const now = Date.now();
  const phase = phaseOf(timer);
  const remaining = timer.mode === 'idle' ? data.settings.focusMinutes * 60_000 : getRemainingMs(timer, now);
  const activeTodo = data.todos.find((t) => t.id === activeTodoId);
  const intent =
    timer.mode === 'break' ? (phase === 'long' ? '긴 휴식 · 스트레칭 어때?' : '짧은 휴식 · 물 한 잔') : activeTodo ? `지금 할 일: ${activeTodo.title}` : '할 일 탭에서 지금 할 일 지정';

  $(root, '#ring').innerHTML = progressRing(getTimerProgress(timer, now), PHASE_COLOR[phase]);
  const digits = $(root, '#digits');
  digits.textContent = formatRemaining(remaining);
  digits.classList.toggle('paused', isTimerPaused(timer));
  $(root, '#intent').textContent = intent;

  root.querySelectorAll<HTMLElement>('.chip').forEach((chip) => {
    const active = chip.dataset.phase === (phase === 'idle' ? 'focus' : phase);
    chip.classList.toggle('active', active);
    chip.style.setProperty('--chip-color', PHASE_COLOR[chip.dataset.phase as PhaseKind]);
  });
};

const renderControls = () => {
  const { timer } = petStore.getState();
  const paused = isTimerPaused(timer);
  const controls = $(root, '#controls');
  if (timer.mode === 'idle') {
    controls.innerHTML = `<button class="primary" type="button" data-action="start">${pixelIcon('play')} 집중 시작</button>`;
  } else if (timer.mode === 'focus') {
    controls.innerHTML = `
      <button class="primary" type="button" data-action="pause">${pixelIcon(paused ? 'play' : 'pause')} ${paused ? '재개' : '일시정지'}</button>
      <button type="button" data-action="abandon" data-tip="기록은 '중단'으로 남아요">${pixelIcon('stop')} 그만두기</button>`;
  } else {
    controls.innerHTML = `
      <button type="button" data-action="pause">${pixelIcon(paused ? 'play' : 'pause')} ${paused ? '재개' : '일시정지'}</button>
      <button class="primary" type="button" data-action="skip">${pixelIcon('next')} 휴식 건너뛰기</button>`;
  }
};

const renderReflection = () => {
  const { awaitingReflection } = petStore.getState();
  const box = $(root, '#reflection');
  if (awaitingReflection === reflectionShown) return;
  reflectionShown = awaitingReflection;
  box.hidden = !awaitingReflection;
  if (!awaitingReflection) return;
  mood = null;
  box.innerHTML = `
    <div class="section-title">이번 세션 어땠어? <small>선택 사항</small></div>
    <div class="mood" role="group" aria-label="집중도">
      ${moodIcons.map((face, i) => `<button type="button" data-action="mood" data-mood="${i + 1}" aria-pressed="false" aria-label="집중도 ${i + 1}: ${moodLabels[i]}" data-tip="${moodLabels[i]}">${pixelIcon(face)}</button>`).join('')}
    </div>
    <div class="row">
      <input type="text" id="reflection-note" class="grow" maxlength="280" placeholder="한 줄 회고 (Enter 저장)" />
      <button type="button" data-action="save-reflection">저장</button>
    </div>`;
  onEnter($<HTMLInputElement>(box, '#reflection-note'), saveReflection);
};

const saveReflection = async () => {
  const note = $<HTMLInputElement>(root, '#reflection-note')?.value ?? '';
  await api.db.setLastSessionReflection(note, mood ?? undefined);
  petStore.getState().finishReflection();
  await refreshStats();
};

const renderToday = () => {
  const today = data.daily.find((d) => d.dateKey === data.todayKey) ?? { minutes: 0, sessions: 0 };
  const goal = data.settings.dailyGoalSessions;
  $(root, '#today').innerHTML = `
    <div class="section-title">오늘 <small>${formatMinutes(today.minutes)} · 목표 ${goal}개 중 ${today.sessions}개</small></div>
    <div>${tomatoRow(today.sessions, goal)}</div>`;
};

export const pomodoroModule: PanelModule = {
  id: 'pomodoro',
  label: '뽀모도로',
  icon: 'clock',
  watches: ['session', 'clock', 'settings', 'stats', 'todos'],

  mount(el) {
    root = el;
    root.innerHTML = `
      <div class="mode-chips">
        <span class="chip" data-phase="focus">집중</span>
        <span class="chip" data-phase="break">짧은 휴식</span>
        <span class="chip" data-phase="long">긴 휴식</span>
      </div>
      <div class="timer-stage">
        <div id="ring"></div>
        <div class="timer-readout"><span class="timer-digits" id="digits"></span><span class="timer-intent" id="intent"></span></div>
      </div>
      <div class="controls" id="controls"></div>
      <div class="frame reflection" id="reflection" hidden></div>
      <div class="divider"></div>
      <div id="today"></div>
      <div class="hint" id="cycle"></div>`;

    onAction(root, {
      start: () => petStore.getState().startFocus(),
      pause: () => petStore.getState().togglePause(),
      abandon: () => petStore.getState().abandonFocus(),
      skip: () => petStore.getState().skipBreak(),
      mood: (target) => {
        mood = Number(target.dataset.mood);
        root.querySelectorAll('.mood button').forEach((b) => {
          b.classList.toggle('selected', b === target);
          b.setAttribute('aria-pressed', String(b === target));
        });
      },
      'save-reflection': saveReflection
    });
  },

  render() {
    renderClock();
    renderControls();
    renderReflection();
    renderToday();
    const { progress } = petStore.getState();
    const every = data.settings.longBreakEvery;
    const untilLong = every - (progress.completedSessions % every);
    $(root, '#cycle').innerHTML = `긴 휴식까지 ${pixelIcon('tomato')} ${esc(String(untilLong))}개 · ${data.settings.focusMinutes}분 집중 / ${data.settings.breakMinutes}분 휴식`;
  }
};

// The clock is cheap to redraw; the rest only on real changes.
export const renderPomodoroClock = () => root && renderClock();
