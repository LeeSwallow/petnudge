import type { UiModule } from '../module';
import Pomodoro from './Pomodoro.svelte';

export const pomodoroUi: UiModule = { id: 'pomodoro', label: '뽀모도로', icon: 'clock', group: 'focus', order: 20, component: Pomodoro };
