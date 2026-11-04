// The character tab's rules, apart from the screen (tested in logic.test.ts).

// The main pet always counts; friends are the other characters out.
export const onScreenCount = (out: string[], mainId: string) => 1 + out.filter((id) => id !== mainId).length;

export type FriendAction = 'main' | 'add' | 'remove';
export const friendRow = (id: string, mainId: string, out: string[]): FriendAction =>
  id === mainId ? 'main' : out.includes(id) ? 'remove' : 'add';

export const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);
