import { data } from '../../../renderer/data';
import { petStore } from '../../../renderer/store';
import type { TimerSource } from './logic';

// Where a timer widget reads its pomodoro, and what it may do to it. A
// friend's pomodoro will be a feed without start and togglePause.
export type TimerFeed = {
  read: () => TimerSource;
  start?: () => void;
  togglePause?: () => void;
};

export const myTimer: TimerFeed = {
  read: () => ({ timer: petStore.getState().timer, lengths: data.settings }),
  start: () => petStore.getState().startFocus(),
  togglePause: () => petStore.getState().togglePause()
};
