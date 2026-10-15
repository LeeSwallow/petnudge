import { data } from './data';

// Pixel-UI motion: everything runs on a shared 12 fps clock, moves in whole
// pixels and never alpha-fades. Reduced motion turns effects into cuts.

export const FRAME_MS = 83;

const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
export const reducedMotion = () => mediaReduced.matches || data.settings.reduceMotion;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs `draw(frame)` for frames 0..count-1 at 12 fps.
export const frames = async (count: number, draw: (frame: number) => void) => {
  for (let frame = 0; frame < count; frame += 1) {
    draw(frame);
    await wait(FRAME_MS);
  }
};

const playClass = (el: Element, className: string, ms: number) => {
  if (reducedMotion()) return;
  el.classList.remove(className);
  void (el as HTMLElement).offsetWidth;
  el.classList.add(className);
  setTimeout(() => el.classList.remove(className), ms);
};

// Squash & stretch pop: 3 held frames.
export const pop = (el: Element) => playClass(el, 'fx-pop', 260);

// CSS-driven entrances (see styles.css "fx-*"); all well under 200ms.
export const enter = (el: HTMLElement, signature: 'settle' | 'grow' | 'bubble') => playClass(el, `fx-${signature}`, 260);

// Single-pixel confetti bursting from an element; integer motion, 10 frames.
export const confetti = async (from: Element) => {
  if (reducedMotion()) return;
  const { left, top, width, height } = from.getBoundingClientRect();
  const colors = ['var(--focus)', 'var(--long)', 'var(--goal)', 'var(--break)'];
  const bits = Array.from({ length: 10 }, (_, i) => {
    const el = document.createElement('i');
    el.className = 'fx-bit';
    el.style.background = colors[i % colors.length];
    document.body.append(el);
    return { el, x: left + width / 2, y: top + height / 2, vx: Math.round((Math.random() - 0.5) * 8), vy: -Math.round(3 + Math.random() * 5) };
  });
  await frames(10, () => {
    for (const bit of bits) {
      bit.x += bit.vx;
      bit.y += bit.vy;
      bit.vy += 1;
      bit.el.style.transform = `translate(${Math.round(bit.x)}px, ${Math.round(bit.y)}px)`;
    }
  });
  bits.forEach((bit) => bit.el.remove());
};

// The typing currently running in each element; a new line cancels it.
const typing = new WeakMap<HTMLElement, AbortController>();

// Typewriter text: one character per frame, holds at punctuation, click to finish.
// Returns roughly how long the typing takes (ms).
export const typewrite = (el: HTMLElement, text: string) => {
  typing.get(el)?.abort();
  if (reducedMotion()) {
    el.textContent = text;
    return 0;
  }
  const run = new AbortController();
  typing.set(el, run);
  let shown = 0;
  el.textContent = '';
  const finish = () => {
    run.abort();
    el.textContent = text;
  };
  el.addEventListener('click', finish, { once: true, signal: run.signal });
  const step = () => {
    if (run.signal.aborted || !el.isConnected) return;
    shown += 1;
    el.textContent = text.slice(0, shown);
    if (shown >= text.length) return;
    const hold = /[.,!?…]/.test(text[shown - 1]) ? FRAME_MS * 3 : 34;
    setTimeout(step, hold);
  };
  step();
  return [...text].reduce((ms, ch) => ms + (/[.,!?…]/.test(ch) ? FRAME_MS * 3 : 34), 0);
};

// Count a number up on the frame clock (dashboard tiles).
export const countUp = (el: HTMLElement, to: number, format: (n: number) => string) => {
  if (reducedMotion() || to === 0) {
    el.textContent = format(to);
    return;
  }
  void frames(3, (f) => (el.textContent = format(Math.round((to * (f + 1)) / 3))));
};
