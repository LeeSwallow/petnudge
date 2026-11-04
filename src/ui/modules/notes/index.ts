import type { UiModule } from '../module';
import Notes from './Notes.svelte';

export const notesUi: UiModule = { id: 'notes', label: '메모', icon: 'note', group: 'record', order: 10, component: Notes };
