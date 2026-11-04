import type { ChatMessage } from '../../../shared/chat';
import { formatDate, formatTime, t } from '../../i18n';

// The chat tab's wording and lists, apart from the screen (tested in logic.test.ts).

// Today: the time; this year: month and day; before: the whole date.
export const when = (time: number, now: number) => {
  const d = new Date(time);
  const today = new Date(now);
  if (d.toDateString() === today.toDateString()) return formatTime(d);
  return d.getFullYear() === today.getFullYear()
    ? formatDate(d, { month: 'numeric', day: 'numeric' })
    : formatDate(d, { year: 'numeric', month: 'numeric', day: 'numeric' });
};

export const preview = (session: { messages: ChatMessage[] }) => {
  const last = [...session.messages].reverse().find((m) => m.role !== 'tool');
  return last ? `${last.role === 'user' ? t('chat.me') : ''}${last.text}` : t('chat.noMessages');
};

// The friend list: the pet first, then the other characters, then anyone a
// past conversation was with (a character since removed), each once.
export const friendIds = (petId: string, characterIds: string[], sessionCharacterIds: string[]) => [
  ...new Set([petId, ...characterIds, ...sessionCharacterIds])
];

// Whether the conversation should follow new lines down: only when the reader
// is at the bottom or within `threshold` px of it, so scrolling up to read
// back is not undone by a reply streaming in.
export const followBottom = (scrollTop: number, scrollHeight: number, clientHeight: number, threshold = 40) =>
  scrollHeight - scrollTop - clientHeight <= threshold;

export const isGroup =(members: string[], messages: ChatMessage[]) =>
  members.length > 1 || messages.some((m) => m.speaker?.startsWith('guest:'));
