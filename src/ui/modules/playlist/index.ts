import type { UiModule } from '../module';
import { t } from '../../i18n';
import Playlist from './Playlist.svelte';

export const playlistUi: UiModule = { id: 'playlist', get label() { return t('panel.module.playlist'); }, icon: 'music', group: 'focus', order: 30, component: Playlist };
