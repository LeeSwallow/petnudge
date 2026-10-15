// Random emotes: while she's idle and free, every so often she plays one of
// the pack's `emotes` actions (a face, an effect and a line, like a touch
// reaction). Pure: time and randomness come in, so it's testable.

export type Emotes = { actions: string[]; everyMs: [number, number] };

export const createEmoter = (random: () => number = Math.random) => {
  let nextAt = 0;
  const schedule = (now: number, [lo, hi]: [number, number]) => (nextAt = now + lo + random() * (hi - lo));

  // The action to play now, if any. Being busy pushes the next emote back.
  const tick = (now: number, free: boolean, emotes: Emotes | undefined): string | undefined => {
    if (!emotes?.actions.length) return undefined;
    if (!free || nextAt === 0) {
      if (nextAt === 0 || now >= nextAt) schedule(now, emotes.everyMs);
      return undefined;
    }
    if (now < nextAt) return undefined;
    schedule(now, emotes.everyMs);
    return emotes.actions[Math.floor(random() * emotes.actions.length)];
  };

  return { tick };
};
