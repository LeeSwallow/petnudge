// Small DOM helpers for the imperative parts left in the UI (settings'
// backup and AI pages, the quick chat bar).

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
