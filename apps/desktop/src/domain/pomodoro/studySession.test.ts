import { describe, expect, it } from 'vitest';
import { advanceDialogue, advanceTransition } from '../pet/sceneMachine';
import {
  abandonFocus,
  beginFocus,
  createInitialSession,
  finishBreak,
  finishFocusIfDue,
  skipBreak,
  type StudySession
} from './studySession';

const MINUTE = 60_000;

describe('studySession', () => {
  it('begins focus by starting the timer and the focus scene', () => {
    const session = beginFocus(createInitialSession(), 0);

    expect(session.timer.mode).toBe('focus');
    expect(session.timer.endsAt).toBe(25 * MINUTE);
    expect(session.scene.phase).toBe('focus_active');
  });

  it('does not finish focus before the timer ends', () => {
    const session = beginFocus(createInitialSession(), 0);

    expect(finishFocusIfDue(session, 10 * MINUTE, '2026-10-15')).toBe(session);
  });

  it('finishes focus once due: rewards progress, starts break, plays the end chime', () => {
    const session = finishFocusIfDue(beginFocus(createInitialSession(), 0), 25 * MINUTE, '2026-10-15');

    expect(session.progress.completedSessions).toBe(1);
    expect(session.progress.exp).toBe(25);
    expect(session.progress.streakDays).toBe(1);
    expect(session.timer.mode).toBe('break');
    expect(session.timer.endsAt).toBe(30 * MINUTE);
    expect(session.scene.phase).toBe('focus_end_chime');
  });

  it('rewards a session only once even if checked repeatedly', () => {
    let session = beginFocus(createInitialSession(), 0);
    session = finishFocusIfDue(session, 25 * MINUTE, '2026-10-15');
    session = finishFocusIfDue(session, 25 * MINUTE + 1_000, '2026-10-15');

    expect(session.progress.completedSessions).toBe(1);
  });

  it('queues newly unlocked rewards for the UI', () => {
    let session = createInitialSession();
    for (let i = 0; i < 4; i += 1) {
      session = finishFocusIfDue(beginFocus(session, 0), 25 * MINUTE, '2026-10-15');
    }

    expect(session.pendingUnlocks).toEqual(['place-rain-cafe']);
  });

  it('abandoning focus returns to planning without rewards', () => {
    const session = abandonFocus(beginFocus(createInitialSession(), 0));

    expect(session.timer.mode).toBe('idle');
    expect(session.scene.phase).toBe('planning_note_open');
    expect(session.progress.completedSessions).toBe(0);
  });

  it('finishing break opens the planner when the character is idling', () => {
    let session = finishFocusIfDue(beginFocus(createInitialSession(), 0), 25 * MINUTE, '2026-10-15');
    let scene = session.scene;
    for (let i = 0; i < 3; i += 1) scene = advanceTransition(scene);
    for (let i = 0; i < 3; i += 1) scene = advanceDialogue(scene);
    session = { ...session, scene };
    expect(session.scene.phase).toBe('break_idle_window');

    session = finishBreak(session, 30 * MINUTE);

    expect(session.timer.mode).toBe('idle');
    expect(session.scene.phase).toBe('break_planning');
  });

  it('does not finish break early', () => {
    const session = finishFocusIfDue(beginFocus(createInitialSession(), 0), 25 * MINUTE, '2026-10-15');

    expect(finishBreak(session, 26 * MINUTE)).toBe(session);
  });

  it('takes a long break after every longBreakEvery sessions', () => {
    let session: StudySession = createInitialSession();
    session = {
      ...session,
      planner: { ...session.planner, timer: { focusMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 2 } }
    };

    session = finishFocusIfDue(beginFocus(session, 0), 25 * MINUTE, '2026-10-15');
    expect(session.timer.endsAt).toBe(30 * MINUTE);

    session = finishFocusIfDue(beginFocus(session, 0), 25 * MINUTE, '2026-10-15');
    expect(session.timer.endsAt).toBe(40 * MINUTE);
  });

  it('skipping a break ends it immediately', () => {
    const session = skipBreak(finishFocusIfDue(beginFocus(createInitialSession(), 0), 25 * MINUTE, '2026-10-15'));

    expect(session.timer.mode).toBe('idle');
  });

  it('skipping does nothing outside a break', () => {
    const session = beginFocus(createInitialSession(), 0);

    expect(skipBreak(session)).toBe(session);
  });
});
