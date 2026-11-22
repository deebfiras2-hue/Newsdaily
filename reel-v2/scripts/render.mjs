#!/usr/bin/env node
// ZOOMED OUT reel engine v2 — render a spec to a finished, IG-ready MP4.
// usage: node scripts/render.mjs specs/<id>.json OUT.mp4 [--cover OUT.jpg] [--sheet OUT.jpg] [--concurrency N]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const proj = path.resolve(here, '..');
const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : d;
};
const [specArg, outArg] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!specArg || !outArg) {
  console.error('usage: node scripts/render.mjs specs/<id>.json OUT.mp4 [--cover OUT.jpg] [--sheet OUT.jpg] [--concurrency N]');
  process.exit(1);
}
const specPath = path.resolve(specArg);
const out = path.resolve(outArg);
const conc = opt('--concurrency', String(Math.max(1, os.cpus().length)));
const run = (cmd, a, o = {}) => execFileSync(cmd, a, {stdio: 'inherit', cwd: proj, ...o});
const sh = (cmd, a) => execFileSync(cmd, a, {cwd: proj, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});

run('node', ['scripts/sync.mjs']);
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
if (typeof spec.voice.words === 'string') spec.words = JSON.parse(fs.readFileSync(path.join(proj, 'public', spec.voice.words), 'utf8'));
const propsFile = path.join(proj, 'public', '_props.json');
fs.writeFileSync(propsFile, JSON.stringify(spec));

const tmp = path.join(proj, 'out', `${spec.id}.raw.mp4`);
fs.mkdirSync(path.dirname(tmp), {recursive: true});
fs.mkdirSync(path.dirname(out), {recursive: true});
const t0 = Date.now();
run('npx', ['remotion', 'bundle', 'src/index.ts', '--out-dir=build', '--log=error']);
run('npx', ['remotion', 'render', 'build', 'Reel', tmp, `--props=${propsFile}`, `--concurrency=${conc}`, '--codec=h264', '--crf=17',
  '--pixel-format=yuv420p', '--audio-codec=aac', '--audio-bitrate=192k', '--log=warn']);
const t1 = Date.now();

// loudness: measure, then gain + limiter to -14 LUFS / -1 dBTP, 48 kHz AAC, video copied, faststart
const measure = (f) => {
  const e = execFileSync('bash', ['-c', `ffmpeg -hide_banner -nostats -i "${f}" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\\s+(I|Peak):" | tail -2`], {encoding: 'utf8'});
  const [I, P] = e.trim().split('\n').map((l) => parseFloat(l.split(':')[1]));
  return {I, P};
};
// static gain + limiter (2nd stage 4x oversampled = true-peak limiting). AAC adds overshoot on hard transients,
// so re-measure the encoded file and correct gain / ceiling until -14 +-0.3 LUFS and true peak <= -1 dBTP.
let gain = -14 - measure(tmp).I, ceil = -3;
for (let pass = 0; pass < 6; pass++) {
  const lim = Math.pow(10, ceil / 20).toFixed(3);
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', tmp, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
    '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${lim}:attack=1:release=80:level=false,aresample=192000,alimiter=limit=${lim}:attack=1:level=false,aresample=48000`,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out]);
  const {I, P} = measure(out);
  console.log(`loudness pass ${pass}: ${I} LUFS, true peak ${P} dBTP (gain ${gain.toFixed(1)}, ceiling ${ceil.toFixed(1)})`);
  if (Math.abs(I + 14) <= 0.3 && P <= -1.0) break;
  if (P > -1.0) ceil -= P + 1.2;
  gain += -14 - I;
}
fs.rmSync(tmp);

const cover = opt('--cover');
if (cover) {
  run('npx', ['remotion', 'still', 'build', 'Reel', path.resolve(cover), `--props=${propsFile}`, `--frame=${spec.cover?.frame ?? 60}`, '--jpeg-quality=92', '--log=error']);
}
const sheet = opt('--sheet');
if (sheet) {
  // 8 frames at scene midpoints (skips transitions), spread over the reel
  const dur = parseFloat(sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out]));
  const st = (x) => (typeof x === 'number' ? x : (([, i, d]) => spec.words[+i][1] + (d ? +d : 0))(/^w(\d+)([+-][\d.]+)?$/.exec(x)));
  const t0s = spec.scenes.map((sc) => st(sc.start));
  let mids = t0s.map((a, i) => (a + (t0s[i + 1] ?? dur)) / 2 + 0.15);
  while (mids.length > 8) mids.splice(Math.floor(mids.length / 2) - 1, 1);
  while (mids.length < 8) mids.push(dur * (mids.length + 0.5) / 9);
  const n = 8, sel = mids.sort((a, b) => a - b).map((t) => `eq(n\\,${Math.round(t * 30)})`).join('+');
  run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', out, '-vf', `select='${sel}',scale=360:640,tile=4x2:padding=8:color=0x0B0B0F`, '-frames:v', '1', '-q:v', '3', path.resolve(sheet)]);
}
const loud = execFileSync('bash', ['-c', `ffmpeg -hide_banner -nostats -i "${out}" -af ebur128=peak=true -f null - 2>&1 | grep -E "^\\s+(I:|Peak:)" | tail -2`], {encoding: 'utf8'});
console.log(`\nrendered ${out}\nrender time ${((t1 - t0) / 1000).toFixed(0)} s (total ${((Date.now() - t0) / 1000).toFixed(0)} s)\n${loud}`);
