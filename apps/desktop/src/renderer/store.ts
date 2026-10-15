import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import { pauseTimer, resumeTimer } from '../../../mobile/src/domain/timer';
import { toDateKey } from '../../../mobile/src/domain/progress';
import { advanceDialogue, advanceTransition } from '../../../mobile/src/scene/sceneMachine';
import {
  abandonFocus,
  beginFocus,
  createInitialSession,
  finishBreak,
  finishFocusIfDue,
  skipBreak,
  type StudySession
} from '../../../mobile/src/session/studySession';
import type { AppSettings } from '../shared/settings';
import { api } from './api';

type PetState = StudySession & {
  activeTodoId: string | null;
  // Pauses during the current focus session, recorded with the session.
  pauseCount: number;
  // A focus session just finished and has not been reflected on yet.
  awaitingReflection: boolean;
};

type PetActions = {
  applySettings: (settings: AppSettings) => void;
  setActiveTodo: (id: string | null) => void;
  startFocus: () => void;
  togglePause: () => void;
  abandonFocus: () => void;
  skipBreak: () => void;
  tick: (now: number) => void;
  advanceTransition: () => void;
  advanceDialogue: () => void;
  dismissUnlock: () => void;
  finishReflection: () => void;
};

// Session state is persisted to the SQLite key-value table via IPC. A friend
// pet window only reads it (the main window owns the timer).
const sqliteStorage = createJSONStorage(() => ({
  getItem: (key: string) => api.db.getKv(key),
  setItem: (key: string, value: string) => (api.friendId ? undefined : api.db.setKv(key, value)),
  removeItem: (key: string) => (api.friendId ? undefined : api.db.removeKv(key))
}));

export const petStore = createStore<PetState & PetActions>()(
  persist(
    (set) => ({
      ...createInitialSession(),
      activeTodoId: null,
      pauseCount: 0,
      awaitingReflection: false,
      applySettings: (settings) =>
        set((s) => ({
          planner: {
            ...s.planner,
            timer: {
              focusMinutes: settings.focusMinutes,
              breakMinutes: settings.breakMinutes,
              longBreakMinutes: settings.longBreakMinutes,
              longBreakEvery: settings.longBreakEvery
            }
          }
        })),
      setActiveTodo: (id) => set({ activeTodoId: id }),
      startFocus: () => set((s) => ({ ...beginFocus(s, Date.now()), pauseCount: 0, awaitingReflection: false })),
      togglePause: () =>
        set((s) => {
          const now = Date.now();
          if (s.timer.pausedAt != null) return { timer: resumeTimer(s.timer, now) };
          return { timer: pauseTimer(s.timer, now), pauseCount: s.timer.mode === 'focus' ? s.pauseCount + 1 : s.pauseCount };
        }),
      abandonFocus: () => set((s) => abandonFocus(s)),
      skipBreak: () => set((s) => skipBreak(s)),
      tick: (now) =>
        set((s) => {
          const afterFocus = finishFocusIfDue(s, now, toDateKey(new Date(now)));
          if (afterFocus !== s) return { ...afterFocus, awaitingReflection: true };
          return finishBreak(s, now);
        }),
      advanceTransition: () => set((s) => ({ scene: advanceTransition(s.scene) })),
      advanceDialogue: () => set((s) => ({ scene: advanceDialogue(s.scene) })),
      dismissUnlock: () => set((s) => ({ pendingUnlocks: s.pendingUnlocks.slice(1) })),
      finishReflection: () => set({ awaitingReflection: false })
    }),
    {
      name: 'session',
      version: 1,
      storage: sqliteStorage,
      partialize: ({ planner, progress, timer, scene, pendingUnlocks, activeTodoId, pauseCount, awaitingReflection }): PetState => ({
        planner,
        progress,
        timer,
        scene,
        pendingUnlocks,
        activeTodoId,
        pauseCount,
        awaitingReflection
      })
    }
  )
);

export const whenHydrated = () =>
  new Promise<void>((resolve) => {
    if (petStore.persist.hasHydrated()) resolve();
    else petStore.persist.onFinishHydration(() => resolve());
  });
