import type { Widget } from './widget';
import { clockWidget } from './clock';
import { timerWidget } from './timer';
import { todosWidget } from './todos';
import { pinnedWidget } from './pinned';
import { musicWidget } from './music';

// Every widget, in one place and in the order the "+ 위젯 추가" menu lists them.
export const WIDGETS: readonly Widget[] = [clockWidget, timerWidget, todosWidget, pinnedWidget, musicWidget];
