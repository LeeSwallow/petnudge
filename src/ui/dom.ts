// Small DOM helper for the imperative part left in the UI (the quick chat bar).

// Enter submits (ignoring IME composition, which matters for Korean input).
export const onEnter = (input: HTMLInputElement, submit: () => void) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.isComposing) submit();
  });
};
