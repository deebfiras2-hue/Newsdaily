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

---

# Themes

`"theme"` in the spec picks colours, fonts, logo and end card for **both** modes (`src/themes.ts`; default
`DEFAULT_THEME` = `zoomedout` here, `behindthebrand` / `chispa` in the copies in those repos).

| theme | look | fonts | accent |
|---|---|---|---|
| `zoomedout` | current ZOOMED OUT look (near-black, red) | Anton titles (caps), Inter text | `#FF2D2D` |
| `behindthebrand` | ink `#111111` stage, cream `#F3EEE4` lines/text (cream `#F3EEE4` / ink `#111111` brand) | Gelasio titles, Barlow Bold text | green `#0E9F6E` |
| `chispa` | Tinte `#0B2125` + Petrol `#0F5560` glow, Nebel `#EEF4EF` lines, Salbei `#9DB8A4` labels | Karantina titles (mixed case, no capital ß), Noto Sans text | Funke `#FF8A3D` (the ONLY accent) |

GRAPHICS scenes are themed by palette + font aliasing (the theme's fonts are registered under the `ZO-Anton` /
`ZO-Inter` names, the top bar shows the theme's brand name). The `la-end` card is themed (Chispa: wordmark from
`public/themes/chispa`, typed sign-off, „Stimme mit KI erstellt“). Theme fonts/logos live in `public/themes/<id>/`
(committed); the monospace is JetBrains Mono (`@fontsource/jetbrains-mono`, OFL) in `public/themes/common/`.

# LINEART mode (Line-Art Story)

Minimal glowing line-art pictograms instead of photos: stick figures (round head, line body, no face) and objects as
thin bright outlines (3.7 px at 1080 wide) with a soft glow, off-white, exactly ONE accent colour on one detail
(awning, phone screen, fresh tiles, a key word). Big glowing title on top, a tiny spaced monospace label below it,
narration typed word by word in sync with the voice (one sentence at a time, lower-left; `"narration": {"pos": "top"}`
for top-left), backgrounds `warm` (dark + soft centre glow) or `grid` (deep navy + fine grid), grain, slow camera drift.
Elements DRAW ON stroke by stroke (stroke-dashoffset, lengths from `@remotion/paths`), the glow fades in after the
strokes. SFX are automatic (soft tick per drawn pictogram, pop on accents / lit, whoosh on camera pushes and `fade`
transitions); music is ducked from the word timings (`speechDb` −20 ≈ the requested −20 dB under speech).

Mode: `"mode": "lineart"` (or automatic when the first scene is an `la-*` scene) → no top bar / word captions, typed
narration instead. Scenes can still be mixed with GRAPHICS scenes in one spec. Use `"transition": "fade"` between
line-art scenes.

### STYLE CHOICE RULE

- **LINEART** for psychology, how-it-works, pricing, thought experiments, A-vs-B stories, tips for small businesses —
  anything that is an idea, not a photographed event.
- **GRAPHICS** for news with real photos, real places, maps, spacecraft, people in the news.
- Unsure? If the strongest visual is a real photo → GRAPHICS. If the strongest visual is a comparison → LINEART.

### Scene types

All `la-*` scenes share: `title`, `label` or `labels: [{at, text}]` (label typed in mono; a title/label identical to
the previous scene's stays put), `bg` (`warm`|`grid`), `items` (below), `camera: [{at, dur, x, y, s}]` (point x,y
moves to the centre at zoom s; slow push `drift` 0.035 by default), `narration: false`.

| type | what | extra props |
|---|---|---|
| `la-title` | big centred title (+ label) | `titleY`, `titleSize` |
| `la-split` | A-vs-B on one thin ground line (person – object – person) or two halves with a dashed divider; one side then changes through item `keys` (lit / dim / pose / walk) | `ground` (y or false), `groundFrom/To`, `divider`, `sides: ["A","B"]`, `sidesY` |
| `la-transform` | pictogram `from` undraws while `to` draws in its place with a pop | `from`, `to` (items), `morphAt` |
| `la-counter` | big monospace number counting up + mono caption | `value`, `start`, `at`, `countDur`, `prefix`, `suffix`, `decimals`, `caption`, `y` |
| `la-flow` | icons connected by drawing arrows, one after another | `nodes: [{kind, label, params, accent}]`, `at`, `step`, `dir` (`h`/`v`), `y` |
| `la-reveal` | statement revealed word by word in sync with the voice, accent word + drawn underline | `lines: [{text, fromWord, accent: [..], size, font: title|text, y}]` |
| `la-end` | theme end card: logo/wordmark, line, sign-off typed in sync, outro word, small note | `signoff`, `fromWord`, `outro`, `outroWord`, `note` |

### Items (`items: [...]`, screen px on the 1080×1920 canvas, times = seconds from scene start or `"w12"` word refs)

| type | props |
|---|---|
| `picto` (default) | `kind`, `x`, `y` (origin = feet / ground for grounded things, centre for icons), `s`, `flip`, `params` (`pose`, `hair`, `dress`, `vest`, `tie`, `hold`, `screen`, `text`, `n`, `pole`, `open`), `accent` (accent detail on from the start), `at`, `dd` (draw time), `out`, `outDur`, `clip: [x1,y1,x2,y2]`, `keys: [{at, dur, x, y, s, o, dim, lit, pose, walk, flip}]`, `sfx` |
| `text` | `text`, `font` (`title`/`text`/`mono`), `size`, `color` (`line`/`accent`/`muted`/`text`/#hex), `anim` (`type`/`fade`/`words` + `fromWord`), `box` (stamp), `align`, `width`, `spacing` |
| `line` / `arrow` | `from: [x,y]`, `to: [x,y]` or x, `bend`, `dashed`, `accent` |
| `grid` | abstract profile grid (avatar, bio lines, 3×3 tiles; no logo): `w`, `content` (`full`/`empty`), `stale: {at}` (greys out), `fresh: {at, step}` (tiles fill in the accent) |
| `counter` | `value`, `start`, `dur`, `prefix`, `suffix`, `decimals`, `size` |

Keys: `walk: true` animates a walk cycle while moving to the key's `x`; `lit: 1` = accent detail lights up + glow
brightens + soft accent halo; `dim: 0.75` = greyed out.

**Pictograms** (`src/lineart/picto.ts`, all parametric and drawable): `person` (poses `stand`, `walk`, `point`,
`phone`, `wave`, `hold`, `think`, `sit`), `woman`, `barber`, `crowd`, `shop`/`storefront`, `barbershop`,
`barberChair`, `scissors`, `comb`, `cafeTable`, `cup`, `croissant`, `bread`, `oven`, `wrench`, `toolbox`, `van`,
`counter`, `door`, `phone` (`screen`: `blank`/`grid`/`post`/`lit`), `feed` (profile grid), `calendar`, `clock`,
`coin`, `coinStack`, `banknote`, `priceTag`, `receipt`, `contract`, `chart`, `arrow`, `lightbulb`, `speechBubble`,
`question`, `check`, `cross`, `house`, `office`, `car`, `globe`, `planet`, `rocket`, `sign`. Add one = a function
returning `[{d, a?, fill?, w?}]` (a person is ~100 units tall).

Quick QA without a full render: `node scripts/stills.mjs specs/<id>.json sheet.jpg 30,120,240,400 --scale 0.5`.

### Worked example — LINEART (`specs/zwei-friseure.json`, Chispa, German)

```jsonc
{
  "id": "zwei-friseure", "theme": "chispa", "mode": "lineart",
  "voice": {"src": "zwei-friseure/voice.mp3", "words": "zwei-friseure/words.json"},
  "music": {"src": "music/curious-1.mp3", "speechDb": -20, "gapDb": -15, "tailDb": -12},
  "narration": {"pos": "bottom", "y": 1470, "size": 58},
  "scenes": [
    {"type": "la-split", "start": 0, "title": "Zwei Friseure.", "label": "G L E I C H E   S T R A S S E", "ground": 1150,
     "camera": [{"at": "w15", "dur": 0.8, "x": 569, "y": 1000, "s": 5.5}],
     "items": [
       {"kind": "barbershop", "x": 290, "y": 1150, "s": 2.1, "at": 0.3, "params": {"text": "FRISEUR"}},
       {"kind": "barbershop", "x": 790, "y": 1150, "s": 2.1, "at": "w2", "params": {"text": "FRISEUR"}},
       {"kind": "woman", "x": 460, "y": 1150, "s": 1.9, "at": "w6",
        "keys": [{"at": "w7", "dur": 1.3, "x": 540, "walk": true}, {"at": "w11", "pose": "phone"}, {"at": "w15", "lit": 1}]}]},
    {"type": "la-split", "start": "w16", "transition": "fade", "title": "Zwei Friseure.", "label": "I N S T A G R A M",
     "ground": false, "sides": ["N R .  1", "N R .  2"],
     "items": [
       {"kind": "phone", "x": 290, "y": 860, "s": 5},
       {"type": "grid", "x": 290, "y": 872, "w": 165, "content": "full", "stale": {"at": "w18"}},
       {"type": "text", "text": "MÄRZ", "font": "mono", "box": true, "x": 290, "y": 846, "at": "w21"},
       {"kind": "phone", "x": 790, "y": 860, "s": 5, "at": "w22"},
       {"type": "grid", "x": 790, "y": 872, "w": 165, "content": "empty", "fresh": {"at": "w24", "step": 0.13}}]},
    {"type": "la-reveal", "start": "w39", "transition": "fade",
     "lines": [{"text": "Dein Profil ist", "fromWord": 39}, {"text": "dein Schaufenster.", "fromWord": 42, "accent": ["Schaufenster"]}]},
    {"type": "la-end", "start": "w49", "transition": "fade", "signoff": "Content, der den Daumen stoppt.", "fromWord": 49,
     "outro": "Chispa!", "outroWord": 54}
  ]
}
```

### Worked example — GRAPHICS (`specs/bepicolombo.json`, ZOOMED OUT)

```jsonc
{
  "id": "bepicolombo", "theme": "zoomedout", "tag": "SPACE", "date": "22 NOV 2026",
  "voice": {"src": "demo/voice.mp3", "words": "demo/words.json"},
  "music": {"src": "music/epic-1.mp3", "speechDb": -21, "gapDb": -14, "tailDb": -13},
  "captions": {"red": ["mercury", "2018"]},
  "scenes": [
    {"type": "zoomOut", "start": 0, "mode": "space", "image": "demo/mercury_messenger.png", "pin": {"label": "MERCURY"}},
    {"type": "photo", "start": "w9-0.1", "src": "demo/bepi_stack.jpg", "fg": "demo/bepi_stack_fg.png", "credit": "ESA–C. Carreau, CC BY-SA 3.0 IGO"},
    {"type": "counter", "start": "w33-0.1", "value": 9, "unit": "FLYBYS"},
    {"type": "end", "start": "w78-0.15", "transition": "bracket"}
  ]
}
```
(abridged — see the full file for every prop).
