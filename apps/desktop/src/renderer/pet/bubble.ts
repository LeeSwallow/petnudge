import { unlockables } from '../../domain/progress/progress';
import { formatRemaining, getRemainingMs, isTimerPaused } from '../../domain/pomodoro/timer';
import { api } from '../api';
import { data } from '../data';
import { typewrite } from '../fx';
import { petStore } from '../store';
import { activeAction, currentReaction, pet } from './state';

// The speech bubble above her: action lines, unlocks, break dialogue, the
// timer, sleep, or a hint. She moves her mouth while a line is typed.

const dialogueLines = [
  '...수고했어! 이번 세션 진짜 집중 잘하더라.',
  '잠깐 기지개 켜고, 물도 한 모금 마시자.',
  '다음엔 뭐부터 할지 같이 정해볼까?'
];

const bubble = document.getElementById('bubble') as HTMLDivElement;
let lastBubbleKey = '';
let talkUntil = 0;
let holdUntil = 0; // a script or chat line stays up until then

const say = (text: string) => {
  talkUntil = Date.now() + typewrite(bubble, text);
};

export const isTalking = () => Date.now() < talkUntil;

// A script's line, shown right away (it replaces whatever the bubble showed).
export const sayNow = (line: string, holdMs = 2500) => {
  lastBubbleKey = `script:${Date.now()}`;
  bubble.classList.remove('clickable');
  say(line);
  holdUntil = talkUntil + holdMs;
};

export const renderBubble = (panelOpen: boolean) => {
  pet.panelShown = panelOpen;
  const { scene, timer, pendingUnlocks } = petStore.getState();
  const acting = activeAction();
  const unlock = unlockables.find((u) => u.id === pendingUnlocks[0]);
  let key: string;
  let render: () => void;
  if (Date.now() < holdUntil) return;
  // A friend pet only speaks the lines it is given.
  if (api.friendId && !acting?.line) return;

  if (acting?.line) {
    key = `action:${acting.startedAt}`;
    const line = acting.line;
    render = () => say(line);
  } else if (unlock) {
    key = `unlock:${unlock.id}`;
    render = () => say(`해금! ${unlock.kind === 'place' ? '새 장소' : '새 옷'}: ${unlock.title} ✨`);
  } else if (scene.phase === 'break_dialogue_active') {
    key = `dialogue:${scene.dialogueTurn}`;
    render = () => say(dialogueLines[Math.min(scene.dialogueTurn, dialogueLines.length - 1)]);
  } else if (timer.mode !== 'idle') {
    const paused = isTimerPaused(timer) ? ' ❚❚' : '';
    const label = timer.mode === 'focus' ? '집중' : '휴식';
    key = 'timer';
    bubble.innerHTML = `${label} <span class="digits">${formatRemaining(getRemainingMs(timer, Date.now()))}</span>${paused}`;
    lastBubbleKey = key;
    bubble.classList.remove('clickable');
    return;
  } else if (currentReaction() === 'sleepy') {
    key = 'sleepy';
    render = () => (bubble.textContent = 'Zzz… (쓰다듬어 깨우기)');
  } else {
    key = panelOpen ? 'empty' : 'hint';
    render = () =>
      panelOpen ? (bubble.textContent = '') : say(data.settings.nickname ? `${data.settings.nickname}, 공부할 준비 됐어?` : '나를 눌러봐! 공부 같이 하자');
  }

  bubble.classList.toggle('clickable', key.startsWith('unlock') || key.startsWith('dialogue'));
  if (key === lastBubbleKey) return;
  lastBubbleKey = key;
  render();
};

bubble.addEventListener('click', () => {
  const state = petStore.getState();
  if (state.pendingUnlocks.length > 0) state.dismissUnlock();
  else if (state.scene.phase === 'break_dialogue_active') state.advanceDialogue();
});
