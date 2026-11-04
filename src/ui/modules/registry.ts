import type { UiModule } from './module';
import { homeUi } from './home';
import { todoUi } from './todo';
import { pomodoroUi } from './pomodoro';
import { playlistUi } from './playlist';
import { notesUi } from './notes';
import { dashboardUi } from './dashboard';
import { chatUi } from './chat';
import { friendsUi } from './friends';
import { settingsUi } from './settings';

// Every panel module, in one place. A module says its own group and order;
// the panel builds its tabs from this list.
export const MODULES: readonly UiModule[] = [homeUi, todoUi, pomodoroUi, playlistUi, notesUi, dashboardUi, chatUi, settingsUi, friendsUi];
