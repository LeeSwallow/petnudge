import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { addTodo, adjustFocusMinutes, removeTodo, setGoal, toggleTodo } from '../domain/planner';
import { toDateKey } from '../domain/progress';
import { advanceDialogue, advanceTransition, openBreakPlanner } from '../scene/sceneMachine';
import {
  abandonFocus,
  beginFocus,
  createInitialSession,
  finishBreak,
  finishFocusIfDue,
  type StudySession
} from '../session/studySession';

type StudyActions = {
  setGoal: (goal: string) => void;
  addTodo: (title: string) => void;
  toggleTodo: (id: string) => void;
  removeTodo: (id: string) => void;
  adjustFocusMinutes: (delta: number) => void;
  startFocus: () => void;
  abandonFocus: () => void;
  // Called on every clock tick; settles timers that have run out.
  tick: (now: number) => void;
  advanceTransition: () => void;
  advanceDialogue: () => void;
  openBreakPlanner: () => void;
  dismissUnlock: () => void;
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const useStudyStore = create<StudySession & StudyActions>()(
  persist(
    (set) => ({
      ...createInitialSession(),
      setGoal: (goal) => set((s) => ({ planner: setGoal(s.planner, goal) })),
      addTodo: (title) => set((s) => ({ planner: addTodo(s.planner, title, createId()) })),
      toggleTodo: (id) => set((s) => ({ planner: toggleTodo(s.planner, id) })),
      removeTodo: (id) => set((s) => ({ planner: removeTodo(s.planner, id) })),
      adjustFocusMinutes: (delta) => set((s) => ({ planner: adjustFocusMinutes(s.planner, delta) })),
      startFocus: () => set((s) => beginFocus(s, Date.now())),
      abandonFocus: () => set((s) => abandonFocus(s)),
      tick: (now) =>
        set((s) => {
          const afterFocus = finishFocusIfDue(s, now, toDateKey(new Date(now)));
          return afterFocus === s ? finishBreak(s, now) : afterFocus;
        }),
      advanceTransition: () => set((s) => ({ scene: advanceTransition(s.scene) })),
      advanceDialogue: () => set((s) => ({ scene: advanceDialogue(s.scene) })),
      openBreakPlanner: () => set((s) => ({ scene: openBreakPlanner(s.scene) })),
      dismissUnlock: () => set((s) => ({ pendingUnlocks: s.pendingUnlocks.slice(1) }))
    }),
    {
      name: 'study-companion',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ planner, progress, timer, scene, pendingUnlocks }): StudySession => ({
        planner,
        progress,
        timer,
        scene,
        pendingUnlocks
      })
    }
  )
);
