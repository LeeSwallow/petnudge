import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';

const common = { bundle: true, sourcemap: true, logLevel: 'warning', target: 'es2022' };
const fonts = ['Galmuri11.woff2', 'Galmuri11-Bold.woff2', 'Galmuri9.woff2', 'GalmuriMono11.woff2', 'LICENSE.txt'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/renderer/fonts', { recursive: true });
await cp('assets/characters', 'dist/characters', { recursive: true, filter: (f) => !f.endsWith('.md') });
await cp('assets/mods', 'dist/mods', { recursive: true });
await Promise.all([
  build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer/renderer.js', platform: 'browser', format: 'iife', loader: { '.png': 'dataurl' } }),
  ...['index.html', 'styles.css', 'data-views.css', 'fonts.css'].map((file) => cp(`src/renderer/${file}`, `dist/renderer/${file}`)),
  ...fonts.map((file) => cp(`node_modules/galmuri/dist/${file}`, `dist/renderer/fonts/${file}`))
]);
console.log('built dist/');
