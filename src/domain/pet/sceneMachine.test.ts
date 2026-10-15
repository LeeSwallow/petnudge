import { describe, expect, it } from 'vitest';
import {
  advanceDialogue,
  advanceTransition,
  completeFocus,
  createInitialSceneState,
  openBreakPlanner,
  startFocus
} from './sceneMachine';

describe('sceneMachine', () => {
  it('starts at the planning note phase with a calm morning setup', () => {
    const state = createInitialSceneState();

    expect(state.phase).toBe('planning_note_open');
    expect(state.lightingMood).toBe('morning_soft');
    expect(state.characterAnimation).toBe('idle_blink');
    expect(state.dialogueTurn).toBe(0);
  });

  it('starts focus with steady lighting and writing animation', () => {
    const state = startFocus(createInitialSceneState());

    expect(state.phase).toBe('focus_active');
    expect(state.lightingMood).toBe('focus_steady');
    expect(state.characterAnimation).toBe('focus_writing');
  });

  it('completes focus by entering the ordered break transition', () => {
    const focus = startFocus(createInitialSceneState());
    const chime = completeFocus(focus);
    const penDown = advanceTransition(chime);
    const sip = advanceTransition(penDown);
    const dialogue = advanceTransition(sip);

    expect(chime.phase).toBe('focus_end_chime');
    expect(penDown.phase).toBe('character_pen_down');
    expect(penDown.characterAnimation).toBe('pen_down');
    expect(sip.phase).toBe('character_sip');
    expect(sip.characterAnimation).toBe('cup_sip');
    expect(dialogue.phase).toBe('break_dialogue_active');
    expect(dialogue.lightingMood).toBe('break_warm');
  });

  it('limits reward dialogue and then moves to break idle', () => {
    const dialogue = advanceTransition(
      advanceTransition(
        advanceTransition(completeFocus(startFocus(createInitialSceneState())))
      )
    );

    const turnOne = advanceDialogue(dialogue);
    const turnTwo = advanceDialogue(turnOne);
    const idle = advanceDialogue(turnTwo);

    expect(turnOne.phase).toBe('break_dialogue_active');
    expect(turnOne.dialogueTurn).toBe(1);
    expect(turnTwo.phase).toBe('break_dialogue_active');
    expect(turnTwo.dialogueTurn).toBe(2);
    expect(idle.phase).toBe('break_idle_window');
    expect(idle.characterAnimation).toBe('window_idle');
  });

  it('opens planner tools during break idle instead of continuing chat forever', () => {
    const idle = {
      ...createInitialSceneState(),
      phase: 'break_idle_window' as const,
      lightingMood: 'break_warm' as const,
      characterAnimation: 'window_idle' as const
    };

    const planning = openBreakPlanner(idle);

    expect(planning.phase).toBe('break_planning');
    expect(planning.inputLocked).toBe(false);
  });
});
