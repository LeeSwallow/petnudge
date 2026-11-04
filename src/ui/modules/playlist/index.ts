import type { UiModule } from '../module';
import Playlist from './Playlist.svelte';

export const playlistUi: UiModule = { id: 'playlist', label: '음악', icon: 'music', group: 'focus', order: 30, component: Playlist };
