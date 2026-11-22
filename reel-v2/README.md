# ZOOMED OUT — Reel engine v2 (Remotion)

Premium, data-driven 9:16 reels for **@zoomed.out.365**. One JSON spec (scenes + voice + word
alignment + assets) → a finished 1080×1920 / 30 fps / H.264 yuv420p / AAC 48 kHz / −14 LUFS MP4
with `+faststart`, ready to upload.

Demo: `posts/2026-11-22/REELS/v2-demo-bepicolombo.mp4` (spec: `specs/bepicolombo.json`).

```
reel-v2/
  specs/<id>.json        one spec per reel (the only thing the daily routine writes)
  public/global/         shared textures: Blue Marble (NASA, PD), Mercury MDIS MD3 mosaic (NASA/JHUAPL, PD),
                         SDO Sun (NASA, PD), Venus, world-atlas countries-110m (Natural Earth, PD), grain.png
  public/<id>/           per-reel assets: voice.mp3, words.json, photos, cut-outs
  public/fonts|sfx|music synced copies of ../fonts, ../assets/sfx, ../assets/music (gitignored)
  src/scenes/*           the scene components (see below)
  src/components/*       Planet (sphere renderer), Captions, Transition, Brackets/Logo, Pin, Starfield, Finish
  scripts/render.mjs     sync → bundle → render → loudness → cover → contact sheet
  tools/cutout.py        rembg foreground cut-out for 2.5D photo parallax
```

## Setup (once per container)

```bash
cd reel-v2
npm ci                       # or: npm install
npx remotion browser ensure  # downloads headless Chrome
pip install rembg onnxruntime   # only for tools/cutout.py (run it with python3.13 in this container)
```

## Render a reel

```bash
node scripts/render.mjs specs/<id>.json ../posts/<date>/REELS/<name>.mp4 \
     --cover ../posts/<date>/REELS/<name>-cover.jpg \
     --sheet ../posts/<date>/REELS/<name>-contact-sheet.jpg --concurrency 4
```

- ~35 s reel: **~3.5–4 min render on 4 vCPU** (≈ 6–7 s of render per second of video) + ~30 s audio passes.
- Loudness: the script measures, applies static gain and a 2-stage (4× oversampled) limiter, then re-measures the
  encoded AAC until −14 ±0.3 LUFS and true peak ≤ −1 dBTP.
- Preview / tweak interactively: `npx remotion studio` (opens the demo spec as default props).
- Single frame check: `npx remotion still src/index.ts Reel out/f.jpg --frame=120 --props=specs/<id>.json --scale=0.5`.

## Daily workflow (for the creator routine)

1. **Voice**: ElevenLabs `POST /v1/text-to-speech/<voice_id>/with-timestamps` using the voice/model/settings in
   `../config/voice.json` (the demo used Liam `TX3LPaxmHKxFdv7VOQHJ`, eleven_multilingual_v2, stability 0.35,
   similarity 0.8, style 0.45, speaker boost). Speed it up with
   `ffmpeg -af atempo=1.1` and divide every alignment time by 1.1. Save `public/<id>/voice.mp3` and
   `public/<id>/words.json` = `[[word, start, end], ...]` (split characters on whitespace; see the snippet below).
2. **Visuals**: legal images only (NASA = public domain; ESA = usually CC BY-SA 3.0 IGO → credit; Wikimedia
   Commons with the license shown; Pixabay video only as background texture). Put them in `public/<id>/`.
   For depth on a photo card: `python3.13 tools/cutout.py public/<id>/photo.jpg public/<id>/photo_fg.png`.
3. **Spec**: copy `specs/bepicolombo.json`, change the scenes, start each scene on a word (`"w12"` = start of word
   12 in words.json, `"w12-0.1"` = 0.1 s before it). Aim for a new scene / visual change every 1–2.5 s.
4. Render (above), look at the contact sheet + cover, fix, re-render.

```python
# alignment -> words.json (S = atempo factor)
words, cur, s = [], '', None
for c, t0, t1 in zip(a['characters'], a['character_start_times_seconds'], a['character_end_times_seconds']):
    if c.isspace():
        if cur: words.append([cur, round(s/S, 3), round(e/S, 3)]); cur = ''
        continue
    if not cur: s = t0
    cur += c; e = t1
if cur: words.append([cur, round(s/S, 3), round(e/S, 3)])
```

## Spec format

```jsonc
{
  "id": "bepicolombo",
  "tag": "SPACE", "date": "22 NOV 2026",            // top bar
  "voice": {"src": "demo/voice.mp3", "words": "demo/words.json"},
  "music": {"src": "music/epic-1.mp3", "speechDb": -21, "gapDb": -14, "tailDb": -13, "offset": 0},
  "captions": {
    "red": ["mercury", "2018"],                       // words drawn red (case/punctuation-insensitive)
    "replace": [{"from": 21, "to": 22, "text": "2018."}], // merge word indices into one token
    "maxWords": 3, "y": 1330
  },
  "duration": 34.7,                                  // optional; default last word end + 2.6 s
  "cover": {"frame": 84},                            // frame rendered as the cover JPG
  "sfx": [{"src": "sfx/hit.mp3", "at": 12.3, "volume": 0.4}],  // optional extra cues (absolute seconds)
  "scenes": [ { "type": "...", "start": 0 | "w9-0.1", "transition": "whip", "captions": true, ...props } ]
}
```

Music is ducked automatically from the word timings (−21 dB under speech, −14 dB in gaps, −13 dB after the
voice ends; library tracks are normalised to −16 LUFS). Pick the bed by mood from `../assets/music/music.json`.

### Scene-level keys

| key | meaning |
|---|---|
| `start` | seconds, or `"w<i>[±s]"` (word start). A scene lasts until the next scene starts. |
| `transition` | into this scene: `whip` (default, directional motion blur), `whipUp`, `zoom` (zoom-through), `bracket` (viewfinder mask wipe with red brackets), `flash` (white flash + impact), `cut`. Each auto-plays its SFX. |
| `captions` | `false` hides word captions (hook, quote, end card — anything that already shows the words). |
| `overlay` | a kinetic title (same props as `kinetic`) drawn on top of the scene. |

### Components (`type`)

| type | what | main props |
|---|---|---|
| `zoomOut` | **Signature opener.** Tight on a photo detail → pulls back to the full planet → out to the solar system with a red pin (`mode: "space"`), or photo → collapses into a pin on a rotating Blue Marble globe (`mode: "earth"`, `lon`, `lat`). | `image`, `imageSize`, `disc [cx,cy,r]` (planet disc in the photo, px; photo should be an RGBA PNG with the disc cut out), `focus`, `detailEnd`, `revealStart`, `revealEnd`, `lift`, `target`, `bodies`, `pin {label, sub, at, side}` |
| `kinetic` | Huge Anton words slamming in line by line (camera shake, hit SFX), key words red, red brackets snap around one word + label. | `lines [{text, at, red[], bracket, bracketAt, bracketLabel}]`, `exitAt`, `y`, `size` |
| `photo` | Full-bleed photo card, 2.5D parallax (subject cut-out moves faster than the blurred plate), slow push, light sweep masked to the subject, credit tag, kicker + title. | `src`, `fg`, `focus`, `kicker`, `title`, `red[]`, `credit`, `push`, `dir` |
| `counter` | Giant number counting up + unit, punch, red underline wipe, sub line, optional indicator dots. | `value`, `from`, `decimals`, `unit`, `label`, `sub`, `dots`, `source`, `at`, `countDur`, `bg` |
| `route` | `mode: "space"`: orbits + an animated trajectory spiralling through waypoints, flyby markers + live `n/9` counter. `mode: "earth"`: dark Natural-Earth map, highlighted countries, great-circle route line + pins. | space: `orbits`, `waypoints [{a, r, flyby}]`, `tilt`, `drawStart`, `drawDur`; earth: `route [[lon,lat]]`, `highlight [country names]`, `labels` |
| `globe` | Realistic lit 3D globe (Earth with atmosphere, or Mercury / any equirectangular map) spinning to a location, pin + label, optional orbit ring with a spacecraft cut-out going behind/in front of the planet. | `texture` (`earth`/`mercury`/path), `lon`, `lat`, `fromLon`, `radius`, `pin`, `orbit {rx, ry, tilt, period, sat}`, `kicker`, `title` |
| `timeline` | Horizontal timeline that slides item to item; dots light up red with a pulse (tick SFX). | `items [{date, label, at}]`, `kicker`, `title`, `spacing` |
| `bars` | Comparison bars growing with counting values; highlight bar red; bracketed badge stamp. | `bars [{label, sub, value, unit, decimals, highlight}]`, `max`, `badge {text, at}`, `source` |
| `quote` | Quote / fact / question card: words rise in one by one, red key words, bracket frame, optional planet or photo background. | `text` (`\n` = line break), `red[]`, `kicker`, `attribution`, `size`, `y`, `bg {planet|image}`, `impact` |
| `end` | Branded outro: the viewfinder zooms out from full-screen into the logo, dot pops, wordmark wipe, red FOLLOW pill. | `handle`, `tagline`, `cta` |

Every reel also gets: the brand top bar (logo + tag + date, inside the safe area), word-by-word captions
(Inter Black, active word on a red pill, key words red, safe area: below 250 px and above the bottom 420 px),
film grain + vignette, SFX on every transition / number hit / slam, voice + ducked music.

Adding a component: create `src/scenes/MyScene.tsx` (gets its props + `dur`, `words`, `sceneStart`; local frame 0 =
scene start), optionally export a `cues(props)` returning SFX `[{src, at, volume}]`, register it in
`src/scenes/index.ts`.

## SFX library (`../assets/sfx`)

`whoosh-fast` (whip), `whoosh-deep` (zoom / reveals), `impact-boom`, `hit`, `snap` (bracket lock), `tick`, `pop`,
`riser-short`, `counter-roll`, `news-sting` (outro). Generated with ElevenLabs `/v1/sound-generation`
(except the older `hit`, `whoosh`, `news-sting`).

## Limits / notes

- Everything is drawn with DOM/SVG/Canvas2D (the globe is a per-pixel canvas sphere renderer), so it renders
  headless with no GPU and is fully deterministic. No WebGL is needed.
- Render cost is dominated by the canvas planets; big globes on every scene will slow renders down.
- `rembg` cut-outs are good on product/spacecraft shots, weaker on busy scenes — check the PNG before using it.
- Remotion is free for individuals and companies with ≤ 3 employees (Remotion licence); larger teams need a
  company licence.

## Demo credits (BepiColombo)

Mercury photo + MDIS mosaic: NASA/JHUAPL/CIW (public domain) · Earth: NASA Visible Earth Blue Marble (PD) · Sun: NASA/SDO
(PD) · BepiColombo stack photo: ESA–C. Carreau, CC BY-SA 3.0 IGO · BepiColombo model: NASA (PD) · MESSENGER artwork:
NASA/JHUAPL (PD) · Map data: Natural Earth via world-atlas (PD) · Voice: ElevenLabs · Music: ZOOMED OUT library (ElevenLabs Music).
