import { activeSession } from '../../../renderer/chat';

// Which conversation the chat tab shows (null: the friend list). Shared with
// the quick chat bar, whose "크게 보기" opens the tab on her current session.
export const chatView = $state({ open: null as string | null });

export const showActiveSession = () => {
  chatView.open = activeSession().id;
};

// The bubble's "더 보기 ▸" opens the conversation the line came from.
export const showSession = (id: string) => {
  chatView.open = id;
};
