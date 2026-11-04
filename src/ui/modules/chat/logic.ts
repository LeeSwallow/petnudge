import type { ChatMessage } from '../../../shared/chat';

// The chat tab's wording and lists, apart from the screen (tested in logic.test.ts).

// Today: the time; this year: month.day; before: year.month.day.
export const when = (time: number, now: number) => {
  const d = new Date(time);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  return d.getFullYear() === today.getFullYear() ? `${d.getMonth() + 1}.${d.getDate()}` : `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
};

export const preview = (session: { messages: ChatMessage[] }) => {
  const last = [...session.messages].reverse().find((m) => m.role !== 'tool');
  return last ? `${last.role === 'user' ? '나: ' : ''}${last.text}` : '아직 대화가 없어요';
};

// The friend list: the pet first, then the other characters, then anyone a
// past conversation was with (a character since removed), each once.
export const friendIds = (petId: string, characterIds: string[], sessionCharacterIds: string[]) => [
  ...new Set([petId, ...characterIds, ...sessionCharacterIds])
];

export const isGroup = (members: string[], messages: ChatMessage[]) =>
  members.length > 1 || messages.some((m) => m.speaker?.startsWith('guest:'));
