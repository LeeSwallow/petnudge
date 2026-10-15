// Talking to the Aseprite CLI: find it, read the layer list, export the sheet.
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Kept inline (not a .lua file) so the bundled app can run it too.
const INSPECT_LUA = `
local sprite = app.open(app.params["file"])
local layers = {}
local function walk(list, path)
  for _, layer in ipairs(list) do
    if layer.isGroup then
      walk(layer.layers, path == "" and layer.name or (path .. "/" .. layer.name))
    else
      local cel = layer:cel(1)
      layers[#layers + 1] = { name = layer.name, group = path, visible = layer.isVisible, empty = cel == nil or cel.image:isEmpty() }
    end
  end
end
walk(sprite.layers, "")
print(json.encode({ width = sprite.width, height = sprite.height, frames = #sprite.frames, layers = layers }))
`;

export const findAseprite = () => {
  const candidates = [process.env.ASEPRITE,
    '/Applications/Aseprite.app/Contents/MacOS/aseprite',
    path.join(os.homedir(), 'Library/Application Support/Steam/steamapps/common/Aseprite/Aseprite.app/Contents/MacOS/aseprite'),
    'C:/Program Files/Aseprite/Aseprite.exe',
    'C:/Program Files (x86)/Steam/steamapps/common/Aseprite/Aseprite.exe', '/usr/bin/aseprite', '/usr/local/bin/aseprite'];
  const executable = candidates.find((p) => p && existsSync(p));
  if (!executable) throw new Error('Aseprite 실행 파일을 찾지 못했어요. ASEPRITE에 실행 파일 경로를 지정해주세요.');
  return executable;
};

const aseprite = (args) => run(findAseprite(), ['-b', ...args], { timeout: 30_000, maxBuffer: 8 * 1024 * 1024 });

// [{ name, group, visible, empty }] plus canvas size and frame count.
export const inspect = async (source) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'study-inspect-'));
  try {
    const script = path.join(dir, 'inspect.lua');
    await writeFile(script, INSPECT_LUA);
    const { stdout } = await aseprite(['--script-param', `file=${source}`, '--script', script]);
    return JSON.parse(stdout.trim().split('\n').pop());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
};

// Every layer (hidden ones too) as one frame-sized cell in a packed sheet.
// Returns { [layer name]: [x, y] } and the sheet's PNG path.
export const exportSheet = async (source, dir) => {
  const meta = path.join(dir, 'sheet.json');
  const sheet = path.join(dir, 'sheet.png');
  await aseprite(['--all-layers', '--split-layers', source, '--sheet', sheet, '--sheet-type', 'packed',
    '--format', 'json-hash', '--data', meta, '--filename-format', '{layer}']);
  const frames = JSON.parse(await readFile(meta, 'utf8')).frames;
  return { sheet, frames: Object.fromEntries(Object.entries(frames).map(([name, f]) => [name, f.frame])) };
};
