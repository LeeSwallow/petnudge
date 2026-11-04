import { mount } from 'svelte';
import { installTokens } from '../theme/install';
import { installEditorErrorLogging } from './api';
import App from './App.svelte';
import { installTestHooks } from './testHooks';

// The character editor window's entry (dist/editor/editor.js); main opens it
// from Settings › 캐릭터 꾸미기 › 에디터 열기 (src/main/editorWindow.ts).
installEditorErrorLogging();
installTokens();
mount(App, { target: document.getElementById('editor')! });
installTestHooks();
