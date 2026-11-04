import type { UiModule } from '../module';
import { t } from '../../i18n';
import Notes from './Notes.svelte';

export const notesUi: UiModule = { id: 'notes', get label() { return t('panel.module.notes'); }, icon: 'note', group: 'record', order: 10, component: Notes };
