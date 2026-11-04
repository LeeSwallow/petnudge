import { formatRemaining, getRemainingMs, isTimerPaused } from '../../domain/pomodoro/timer';
import { api } from '../api';
import { data } from '../data';
import { stopTyping, typewrite } from '../fx';
import { fitBubble, linePx, MORE_LABEL } from '../../ui/bubble/text';
import { petStore } from '../store';
import { activeAction, currentReaction, pet } from './state';

// The speech bubble above her: action lines, break dialogue, the
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

// The widest the bubble gets: her width while a tall dock stands beside her
// (--head-width), else the window's.
const bubbleWidth = () => {
  const unit = bubble.parentElement!;
  const head = parseFloat(getComputedStyle(unit).getPropertyValue('--head-width'));
  const area = unit.parentElement?.clientWidth || window.innerWidth;
  return Number.isFinite(head) ? Math.min(head, area) : area;
};

// A chat line (plain text, ui/bubble/text.ts): at most three lines, cut with
// "… 더 보기 ▸" (which calls `onMore`) when longer. While a reply streams
// (`final` false) each call passes the line so far; when it only grew, the
// typing goes on from what is shown instead of starting over.
export const sayLine = (line: string, { holdMs, final = true, onMore }: { holdMs: number; final?: boolean; onMore?: () => void }) => {
  const fit = fitBubble(line, linePx(bubbleWidth()), { final });
  let text = bubble.querySelector<HTMLSpanElement>(':scope > .bubble-text');
  const said = text?.dataset.say ?? '';
  const chat = text !== null && lastBubbleKey.startsWith('chat:');
  if (chat && fit.text === said) {
    holdUntil = Math.max(talkUntil, Date.now()) + holdMs;
    return;
  }
  // what was said, less a "…" that cut it
  const base = bubble.querySelector('.bubble-more') ? said.replace(/…$/, '') : said;
  const grows = chat && fit.text.startsWith(base);
  if (!grows || !text) {
    lastBubbleKey = `chat:${Date.now()}`;
    bubble.classList.remove('clickable');
    stopTyping(bubble); // a line typed into the bubble itself ("음… 생각 중") would type over it
    bubble.textContent = '';
    text = document.createElement('span');
    text.className = 'bubble-text';
    bubble.append(text);
  }
  text.dataset.say = fit.text;
  const button = bubble.querySelector('.bubble-more');
  if (!fit.more) button?.remove();
  if (fit.more && onMore && !button) {
    const more = document.createElement('button');
    more.type = 'button';
    more.className = 'bubble-more';
    more.textContent = MORE_LABEL;
    more.addEventListener('click', (event) => {
      event.stopPropagation();
      onMore();
    });
    bubble.append(' ', more);
  }
  const typed = text.textContent ?? '';
  const from = grows && fit.text.startsWith(typed) ? typed.length : grows ? Math.min(typed.length, base.length) : 0;
  talkUntil = Date.now() + typewrite(text, fit.text, from);
  holdUntil = talkUntil + holdMs;
};

export const renderBubble = (panelOpen: boolean) => {
  pet.panelShown = panelOpen;
  const { scene, timer } = petStore.getState();
  const acting = activeAction();
  let key: string;
  let render: () => void;
  if (Date.now() < holdUntil) return;
  // A friend pet only speaks the lines it is given.
  if (api.friendId && !acting?.line) return;

  if (acting?.line) {
    key = `action:${acting.startedAt}`;
    const line = acting.line;
    render = () => say(line);
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

  bubble.classList.toggle('clickable', key.startsWith('dialogue'));
  if (key === lastBubbleKey) return;
  lastBubbleKey = key;
  render();
};

bubble.addEventListener('click', () => {
  const state = petStore.getState();
  if (state.scene.phase === 'break_dialogue_active') state.advanceDialogue();
});
