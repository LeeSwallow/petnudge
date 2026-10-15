import { api } from '../api';
import { pack } from '../character';
import { meetupSession, talkTogether } from '../chat';
import { holdStill } from './behavior';
import { faceToward } from './gaze';
import { around, connectTalk, emit, fireMod } from './mods';

// Friend pets near the main pet (distances come from main/friends.ts):
// entering, leaving and staying near become `friend` mod events, and the
// `talk` block makes the two face each other and chat (AI) for a while.

const TALK_HOLD_MS = 180_000;
const near = new Map<string, { dx: number; since: number }>();

export const nearestFriend = () =>
  [...near].sort((a, b) => Math.abs(a[1].dx) - Math.abs(b[1].dx)).map(([id, info]) => ({ id, ...info }))[0];

const face = (id: string, dx: number, ms: number) => {
  holdStill(ms);
  faceToward(dx, ms);
  api.friendHold(id, ms, -dx);
};

// Faces the nearest friend and chats for `turns` lines in all.
export const talkWithFriend = async (turns: number, topic?: string) => {
  const friend = nearestFriend();
  if (!friend) return;
  face(friend.id, friend.dx, TALK_HOLD_MS);
  try {
    await around('friendTalk', () => talkTogether(meetupSession(pack.id, friend.id).id, turns, topic));
  } finally {
    face(friend.id, friend.dx, 4000); // a last look, then back to wandering
  }
};

export const startFriends = () => {
  connectTalk(talkWithFriend);
  api.onFriendNear(({ id, near: isNear, dx, since }) => {
    const was = near.get(id);
    if (isNear && !was) {
      near.set(id, { dx, since });
      faceToward(dx, 1500); // a glance when someone walks up
      fireMod({ type: 'friend', phase: 'near', id, nearMs: 0, visit: since });
      emit('friendNear', 'after');
    } else if (!isNear && was) {
      near.delete(id);
      fireMod({ type: 'friend', phase: 'leave', id, nearMs: Date.now() - was.since, visit: was.since });
      emit('friendLeave', 'after');
    } else if (isNear && was) {
      was.dx = dx;
      fireMod({ type: 'friend', phase: 'stay', id, nearMs: Date.now() - since, visit: since });
    }
  });
};
