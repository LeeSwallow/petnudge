// Renders the README images in docs/images/ from docs/images/compose/*.html
// with headless Chrome: node scripts/compose-images.mjs
// Run scripts/demo-shots.mjs first for fresh panel and pet captures.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const chrome = process.env.CHROME ?? [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe'
].find(existsSync);
if (!chrome) throw new Error('set CHROME to a Chrome or Chromium binary');

const sizes = { banner: [1280, 640], showcase: [1600, 780], characters: [1200, 420] };
for (const [name, [width, height]] of Object.entries(sizes)) {
  const page = path.resolve('docs/images/compose', `${name}.html`);
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
    `--window-size=${width},${height}`, `--screenshot=${path.resolve('docs/images', `${name}.png`)}`,
    `file://${page}`
  ], { stdio: 'ignore' });
  console.log(`saved docs/images/${name}.png`);
}
