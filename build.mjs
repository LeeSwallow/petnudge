import { build } from 'esbuild';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const common = { bundle: true, sourcemap: true, logLevel: 'warning', target: 'es2022', metafile: true };
const fonts = ['Galmuri11.woff2', 'Galmuri11-Bold.woff2', 'Galmuri9.woff2', 'GalmuriMono11.woff2', 'LICENSE.txt'];

await rm('dist', { recursive: true, force: true });
await mkdir('dist/renderer/fonts', { recursive: true });
await cp('assets/characters', 'dist/characters', { recursive: true, filter: (f) => !f.endsWith('.md') });
await cp('assets/mods', 'dist/mods', { recursive: true });
const results = await Promise.all([
  build({ ...common, entryPoints: ['src/main/main.ts'], outfile: 'dist/main.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/preload/preload.ts'], outfile: 'dist/preload.js', platform: 'node', format: 'cjs', external: ['electron'] }),
  build({ ...common, entryPoints: ['src/renderer/renderer.ts'], outfile: 'dist/renderer/renderer.js', platform: 'browser', format: 'iife', loader: { '.png': 'dataurl' } })
]);
await Promise.all([
  ...['index.html', 'styles.css', 'data-views.css', 'fonts.css'].map((file) => cp(`src/renderer/${file}`, `dist/renderer/${file}`)),
  ...fonts.map((file) => cp(`node_modules/galmuri/dist/${file}`, `dist/renderer/fonts/${file}`)),
  cp('LICENSE', 'dist/LICENSE'),
  cp('THIRD_PARTY_NOTICES.md', 'dist/THIRD_PARTY_NOTICES.md')
]);

// The license of every package bundled into the app, from esbuild's list of
// inputs, into dist/licenses/ (MIT and similar require the notice to ship).
const mitText = (holder) => `MIT License

Copyright (c) ${holder}

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
`;
const packages = new Set();
for (const { metafile } of results) {
  for (const input of Object.keys(metafile.inputs)) {
    // Nested copies (a/node_modules/b) are packages of their own.
    const match = input.match(/^(.*node_modules\/(?:@[^/]+\/)?[^/]+)\//);
    if (match) packages.add(match[1]);
  }
}
await mkdir('dist/licenses', { recursive: true });
const missing = [];
for (const dir of [...packages].sort()) {
  const name = dir.slice(dir.lastIndexOf('node_modules/') + 'node_modules/'.length);
  const file = (await readdir(dir)).find((f) => /^(licen[cs]e|copying|notice)(\.|$)/i.test(f));
  const { version, license, author, repository } = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
  // Some packages publish no license file; for MIT the notice is the standard
  // text with the holder named in package.json.
  if (!file && license !== 'MIT') {
    missing.push(name);
    continue;
  }
  const holder = (typeof author === 'string' ? author : author?.name) ?? `the ${name} authors (${typeof repository === 'string' ? repository : repository?.url})`;
  const text = file ? await readFile(path.join(dir, file), 'utf8') : mitText(holder);
  await writeFile(path.join('dist/licenses', `${name.replace('/', '__')}@${version}.txt`), `${name}@${version} (${license})\n\n${text}`);
}
if (missing.length) throw new Error(`no license text for bundled packages: ${missing.join(', ')}`);
console.log(`built dist/ (${packages.size} bundled packages, licenses in dist/licenses/)`);
