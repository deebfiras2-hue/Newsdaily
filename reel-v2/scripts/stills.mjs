#!/usr/bin/env node
// Quick QA: render a few frames of a spec and tile them into one sheet (no audio, no full render).
// usage: node scripts/stills.mjs specs/<id>.json OUT.jpg 30,120,240,... [--scale 0.5]
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition, openBrowser} from '@remotion/renderer';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const proj = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [specArg, outArg, framesArg] = process.argv.slice(2);
const si = process.argv.indexOf('--scale');
const scale = si > 0 ? +process.argv[si + 1] : 0.5;
execFileSync('node', ['scripts/sync.mjs'], {cwd: proj, stdio: 'inherit'});
const spec = JSON.parse(fs.readFileSync(path.resolve(specArg), 'utf8'));
if (typeof spec.voice.words === 'string') spec.words = JSON.parse(fs.readFileSync(path.join(proj, 'public', spec.voice.words), 'utf8'));
const serveUrl = await bundle({entryPoint: path.join(proj, 'src/index.ts'), publicDir: path.join(proj, 'public')});
const browser = await openBrowser('chrome');
const composition = await selectComposition({serveUrl, id: 'Reel', inputProps: spec, puppeteerInstance: browser});
const frames = framesArg.split(',').map(Number);
const tmp = path.join(proj, 'out', 'stills');
fs.mkdirSync(tmp, {recursive: true});
const files = [];
for (const f of frames) {
  const o = path.join(tmp, `f${String(f).padStart(5, '0')}.png`);
  await renderStill({composition, serveUrl, output: o, frame: f, inputProps: spec, scale, puppeteerInstance: browser});
  files.push(o);
}
await browser.close({silent: true});
const cols = Math.min(4, files.length), rows = Math.ceil(files.length / cols);
const inputs = files.flatMap((f) => ['-i', f]);
if (files.length === 1) execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', files[0], '-q:v', '3', path.resolve(outArg)]);
else execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex',
  `${files.map((_, i) => `[${i}:v]`).join('')}xstack=inputs=${files.length}:layout=${files.map((_, i) => `${(i % cols) ? Array.from({length: i % cols}, () => 'w0').join('+') : '0'}_${Math.floor(i / cols) ? Array.from({length: Math.floor(i / cols)}, () => 'h0').join('+') : '0'}`).join('|')}:fill=black`,
  '-frames:v', '1', '-q:v', '3', path.resolve(outArg)]);
console.log('sheet', outArg, frames.join(','));
