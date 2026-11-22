// Copy shared brand assets from the repo root into public/ (gitignored copies).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const pub = path.resolve(here, '..', 'public');
for (const [src, dst] of [['fonts', 'fonts'], ['assets/sfx', 'sfx'], ['assets/music', 'music']]) {
  const s = path.join(root, src), d = path.join(pub, dst);
  if (!fs.existsSync(s)) continue;
  fs.mkdirSync(d, {recursive: true});
  for (const f of fs.readdirSync(s)) {
    if (!/\.(ttf|otf|mp3|wav|json)$/i.test(f)) continue;
    const a = path.join(s, f), b = path.join(d, f);
    if (!fs.existsSync(b) || fs.statSync(b).size !== fs.statSync(a).size) fs.copyFileSync(a, b);
  }
}
console.log('synced fonts/sfx/music -> public/');
