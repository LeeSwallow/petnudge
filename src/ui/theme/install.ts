import { toCssVars } from './tokens';

// Puts the tokens first in <head>, once, so every later stylesheet sees them.
export const installTokens = (doc: Document = document): void => {
  if (doc.getElementById('petnudge-tokens')) return;
  const style = doc.createElement('style');
  style.id = 'petnudge-tokens';
  style.textContent = toCssVars();
  doc.head.prepend(style);
};
