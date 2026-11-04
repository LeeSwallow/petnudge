// One Svelte setup for the renderer build (build.mjs) and its test: styles go
// in <style> tags at runtime (allowed by the CSP's style-src 'unsafe-inline'),
// and <script lang="ts"> needs no preprocess (Svelte 5 strips the types).
export const svelteOptions = { compilerOptions: { css: 'injected' } };
