import { mount } from 'svelte';
import Probe from './Probe.svelte';

// Entry of the Svelte UI inside the renderer (src/renderer/renderer.ts).
export const mountProbe = (target: HTMLElement) => mount(Probe, { target });
