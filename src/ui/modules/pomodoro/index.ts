import type { UiModule } from '../module';
import { t } from '../../i18n';
import Pomodoro from './Pomodoro.svelte';

export const pomodoroUi: UiModule = { id: 'pomodoro', get label() { return t('panel.module.pomodoro'); }, icon: 'clock', group: 'focus', order: 20, component: Pomodoro };
