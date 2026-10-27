import type { DataKind } from '../data';
import type { PixelIconName } from '../icons';

export type ModuleId = 'todo' | 'pomodoro' | 'dashboard' | 'playlist' | 'notes' | 'chat' | 'friends' | 'settings';

export type PanelModule = {
  id: ModuleId;
  label: string;
  icon: PixelIconName;
  // Builds the static skeleton (inputs keep focus across re-renders).
  mount: (root: HTMLElement) => void;
  // Re-renders dynamic regions; called on data/store changes while visible.
  render: () => void;
  // Data kinds this module displays; other changes skip its render.
  watches: (DataKind | 'session' | 'clock' | 'music')[];
};

export const $ = <T extends Element = HTMLElement>(root: ParentNode, selector: string) => root.querySelector(selector) as T;

// Delegated click handling: <button data-action="x" data-id="…">.
export const onAction = (root: HTMLElement, handlers: Record<string, (target: HTMLElement) => void>) => {
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? (event.target.closest('[data-action]') as HTMLElement | null) : null;
    if (!target || !root.contains(target)) return;
    handlers[target.dataset.action!]?.(target);
  });
};

// Enter submits (ignoring IME composition, which matters for Korean input).
export const onEnter = (input: HTMLInputElement, submit: () => void) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) submit();
  });
};
