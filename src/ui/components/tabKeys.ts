// Keyboard moves in a tab list (WAI-ARIA tabs): the arrows wrap around,
// Home and End jump to the ends. Other keys are not ours (null).
export const step = (ids: readonly string[], current: string, key: string): string | null => {
  if (ids.length === 0) return null;
  const index = ids.indexOf(current);
  switch (key) {
    case 'Home': return ids[0];
    case 'End': return ids[ids.length - 1];
    case 'ArrowRight': return index < 0 ? ids[0] : ids[(index + 1) % ids.length];
    case 'ArrowLeft': return index < 0 ? ids[0] : ids[(index - 1 + ids.length) % ids.length];
    default: return null;
  }
};
