#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let missing = false;
for (const [command, args] of [['node', ['--version']], ['ffmpeg', ['-version']], ['ffprobe', ['-version']]]) {
  const result = spawnSync(command, args, { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) { console.error(`${command}: missing from PATH`); missing = true; }
  else console.log((result.stdout || result.stderr).split(/\r?\n/)[0]);
}
if (Number(process.versions.node.split('.')[0]) < 22) { console.error('Node 22+ required.'); missing = true; }
if (!existsSync(join(root, '.env'))) { copyFileSync(join(root, '.env.example'), join(root, '.env')); console.log('Created local .env. Fill only the keys your chosen services need.'); }
else console.log('Existing .env preserved.');
// WedFlex media library: footage you own and licensed music/SFX (gitignored).
const library = {
  broll: '# B-roll you own\n\nPut footage you own or shot here. Subfolders are fine (e.g. artlist-ai/, app-screens/).\nThe agent checks this folder before searching Pixabay.\n',
  music: '# Licensed music\n\nOnly tracks licensed from Artlist or Pixabay. Add a row for every file; unlisted files are not used.\n\n| File | Source (Artlist/Pixabay) | Track URL or ID | Artist | Mood | Notes |\n| --- | --- | --- | --- | --- | --- |\n',
  sfx: '# Licensed sound effects\n\nOnly effects licensed from Artlist or Pixabay. Add a row for every file; unlisted files are not used.\n\n| File | Source (Artlist/Pixabay) | URL or ID | Sound | Notes |\n| --- | --- | --- | --- | --- |\n',
};
for (const [name, text] of Object.entries(library)) {
  const dir = join(root, 'raw-media', name);
  mkdirSync(dir, { recursive: true });
  const index = join(dir, 'SOURCES.md');
  if (!existsSync(index)) { writeFileSync(index, text); console.log(`Created raw-media/${name}/SOURCES.md`); }
}
console.log('Service setup and alternatives: docs/TOOLS-AND-API-KEYS.md');
console.log('WedFlex house rules: docs/WEDFLEX-HOUSE-RULES.md');
console.log('Next: npx hyperframes doctor (Chrome diagnostics), then npm run demo.');
process.exitCode = missing ? 1 : 0;
