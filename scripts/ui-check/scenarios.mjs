// Every UI check scenario, in the order a full run takes them. Each one sets
// up and cleans up its own data, so any subset runs in any order.
import panel from './panel.mjs';
import dock from './dock.mjs';
import home from './home.mjs';
import clock from './clock.mjs';
import todo from './todo.mjs';
import pomodoro from './pomodoro.mjs';
import notes from './notes.mjs';
import music from './music.mjs';
import dashboard from './dashboard.mjs';
import characters from './characters.mjs';
import settings from './settings.mjs';
import logs from './logs.mjs';
import chat from './chat.mjs';
import locale from './locale.mjs';
import overflow from './overflow.mjs';

export const scenarios = [panel, dock, home, clock, todo, pomodoro, notes, music, dashboard, characters, settings, logs, chat, locale, overflow];
