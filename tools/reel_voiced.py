#!/usr/bin/env python3
"""ZOOMED OUT voiced reel renderer. Extends tools/reel.py (reuses Scene/Ken Burns, outro, pills, progress) + tools/brand.py.
Usage: python3 tools/reel_voiced.py spec.json
Spec: out, cover, category, tag, voice (mp3), words (json [[word,start,end],...] raw secs), speed (1.1),
      shots [{"t":start_sec,"clip":"path.mp4"|"photo":"path","focus":[x,y]}], end_sec, sfx [{"f":path,"t":sec,"v":0.22}],
      display {"Eight":"8"}, merge [[i,j,"2018"]], red [words], punch [secs], outro_sec
"""
import json, os, re, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import reel as RL, render as R, brand

W, H, FPS = RL.W, RL.H, RL.FPS
RED, WHITE, BG = R.RED, R.WHITE, R.BG
_fonts = {}


def font(sz):
    sz = int(sz)
    if sz not in _fonts:
        _fonts[sz] = R.anton(sz)
    return _fonts[sz]


def shade_arr():
    a = R.grad_alpha(H, [(0, 0.50), (450, 0.18), (1000, 0.22), (1500, 0.52), (H, 0.72)])
    return a[:, None, None].astype("float32")


SHADE = shade_arr()
BGC = np.array(BG, dtype="float32")


def decode(path, n):
    p = subprocess.run([RL.ff_exe(), "-loglevel", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-frames:v", str(n), "-"], capture_output=True)
    arr = np.frombuffer(p.stdout, dtype="uint8")
    fr = arr.reshape(-1, H, W, 3)
    if len(fr) < n:
        fr = np.concatenate([fr, np.repeat(fr[-1:], n - len(fr), axis=0)])
    return fr


class Shot:
    def __init__(self, g0, g1, spec, idx):
        self.g0, self.g1, self.n = g0, g1, g1 - g0
        self.kind = "clip" if "clip" in spec else "photo"
        if self.kind == "clip":
            self.frames = decode(spec["clip"], self.n)
        else:
            self.sc = RL.Scene("beat", self.n / FPS, spec["photo"], tuple(spec.get("focus", (0.5, 0.45))), None, None, 1 if idx % 2 == 0 else -1)

    def frame(self, k):
        if self.kind == "photo":
            return self.sc.frame(k)
        f = self.frames[min(k, len(self.frames) - 1)].astype("float32")
        f = f * (1 - SHADE) + BGC * SHADE
        im = Image.fromarray(f.astype("uint8"))
        z = 1.0 + 0.07 * (k / max(1, self.n))
        cw, ch = W / z, H / z
        x0, y0 = (W - cw) / 2, (H - ch) / 2
        return im.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))


def build_tokens(spec, speed):
    words = spec["words"]
    disp = spec.get("display", {})
    merge = {m[0]: m for m in spec.get("merge", [])}
    skip = set()
    toks = []
    redset = {r.lower() for r in spec.get("red", [])}
    for i, (w, s, e) in enumerate(words):
        if i in skip:
            continue
        txt = w
        if i in merge:
            _, j, txt = merge[i]
            e = words[j][2]
            skip.update(range(i + 1, j + 1))
        key = re.sub(r"[^\w'-]", "", w).lower()
        trail = w[-1] if w[-1] in ".,:?!;" else ""
        shown = disp.get(key, txt if i in merge else re.sub(r"[.,:;?!]$", "", w)).upper()
        toks.append(dict(t=shown, s=s / speed, e=e / speed, red=(key in redset or i in merge or shown.isdigit()), end=bool(trail)))
    return toks


def group_tokens(toks, maxw=880):
    groups, cur = [], []
    for t in toks:
        w = font(120).getlength(" ".join(x["t"] for x in cur + [t]))
        if cur and (len(cur) >= 3 or w > maxw):
            groups.append(cur); cur = []
        cur.append(t)
        if t["end"]:
            groups.append(cur); cur = []
    if cur:
        groups.append(cur)
    return groups


def caption_layer(group, now, cy=1150):
    """RGBA layer with the group; the current word pops (1.15 -> 1.0 over 4 frames)."""
    f = font(120)
    gap = f.getlength(" ")
    widths = [f.getlength(t["t"]) for t in group]
    total = sum(widths) + gap * (len(group) - 1)
    x = (W - total) / 2
    lay = Image.new("RGBA", (W, 260), (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    ly = 130
    for t, wd in zip(group, widths):
        if now < t["s"]:
            x += wd + gap
            continue  # word not spoken yet: not shown
        age = (now - t["s"]) * FPS
        sc = 1.0 + 0.15 * max(0.0, 1 - age / 4.0)
        ff = font(120 * sc)
        d.text((x + wd / 2, ly), t["t"], font=ff, fill=RED if t["red"] else WHITE, anchor="mm", stroke_width=11, stroke_fill=(0, 0, 0))
        x += wd + gap
    return lay, cy - ly


def ease(t):
    return RL.ease(t)


def main():
    spec = json.load(open(sys.argv[1]))
    ap = lambda p: p if os.path.isabs(p) else os.path.join(R.ROOT, p)
    out, cover = ap(spec["out"]), ap(spec["cover"])
    os.makedirs(os.path.dirname(out), exist_ok=True)
    speed = spec.get("speed", 1.1)
    end_sec = spec["end_sec"]  # start of end card
    outro_n = int(spec.get("outro_sec", 2.0) * FPS)
    body_n = int(round(end_sec * FPS))
    total = body_n + outro_n
    shots_spec = spec["shots"]
    bounds = [int(round(s["t"] * FPS)) for s in shots_spec] + [body_n]
    shots = [Shot(bounds[i], bounds[i + 1], shots_spec[i], i) for i in range(len(shots_spec))]
    outro = RL.Scene("outro", outro_n / FPS)
    toks = build_tokens(spec, speed)
    groups = group_tokens(toks)
    gspans = []
    for gi, g in enumerate(groups):
        s = g[0]["s"]
        e = groups[gi + 1][0]["s"] if gi + 1 < len(groups) else g[-1]["e"] + 0.4
        e = min(e, g[-1]["e"] + 0.45)
        gspans.append((s, e))
    punches = [int(p * FPS) for p in spec.get("punch", [])]
    cat, tag = spec.get("category", "SPACE"), spec.get("tag", "JUST IN")

    def cap_at(now):
        for g, (s, e) in zip(groups, gspans):
            if s - 0.02 <= now < e:
                return g
        return None

    def render(g):
        if g >= body_n:
            img = outro.frame(g - body_n)
            if g - body_n < 4:
                img = Image.blend(img, Image.new("RGB", (W, H), WHITE), 0.5 * (1 - (g - body_n) / 4))
            RL.progress(img, (g + 1) / total)
            return img
        si = max(i for i, s in enumerate(shots) if s.g0 <= g)
        s = shots[si]
        k = g - s.g0
        img = s.frame(k)
        # whip: blur-shift + flash at cuts
        if si > 0 and k < 4:
            sh = np.roll(np.asarray(img), (k + 1) * -40 if si % 2 else (k + 1) * 40, axis=1)
            img = Image.blend(img, Image.fromarray(sh), 0.5 * (1 - k / 4))
            img = Image.blend(img, Image.new("RGB", (W, H), WHITE), 0.45 * (1 - k / 4))
        # zoom punches (hook + big numbers)
        for p in punches:
            if 0 <= g - p < 9:
                z = 1 + 0.09 * (1 - ease((g - p) / 9.0)) if g - p > 1 else 1.09
                cw, ch = W / z, H / z
                img = img.resize((W, H), Image.BILINEAR, box=((W - cw) / 2, (H - ch) / 2, (W + cw) / 2, (H + ch) / 2))
        now = g / FPS
        grp = cap_at(now)
        if grp:
            lay, y = caption_layer(grp, now)
            img.paste(lay, (0, y), lay)
        if g < 3 * FPS:
            RL.add_pills(img, cat, tag)
            brand.draw_icon(img, W - 72 - 90, 190, 90)
        if g < 15:  # brackets zoom out around the hook
            S = int(900 * (1.45 - 0.45 * ease(g / 15.0)))
            brand.draw_icon(img, (W - S) // 2, 1150 - S // 2, S, dot=False)
        RL.progress(img, (g + 1) / total)
        return img

    c = render(int(0.45 * FPS))
    c.save(cover, quality=95)
    print("cover", cover)

    # audio: voice atempo + loudnorm, sfx mixed ~12 dB under
    inputs = ["-i", ap(spec["voice"])]
    flt = [f"[0:a]atempo={speed},loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000,aformat=channel_layouts=stereo[v]"]
    labels = ["[v]"]
    for i, sx in enumerate(spec["sfx"]):
        inputs += ["-i", ap(sx["f"])]
        ms = int(sx["t"] * 1000)
        flt.append(f"[{i+1}:a]aresample=48000,aformat=channel_layouts=stereo,volume={sx.get('v', 0.22)},adelay={ms}|{ms}[s{i}]")
        labels.append(f"[s{i}]")
    flt.append("".join(labels) + f"amix=inputs={len(labels)}:normalize=0:dropout_transition=0,apad,atrim=0:{total/FPS:.3f}[a]")
    apath = out + ".aac.m4a"
    subprocess.run([RL.ff_exe(), "-y", "-loglevel", "error", *inputs, "-filter_complex", ";".join(flt), "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", apath], check=True)

    cmd = [RL.ff_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", apath,
           "-map", "0:v", "-map", "1:a", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "-r", str(FPS), "-shortest", out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for g in range(total):
        pr.stdin.write(render(g).tobytes())
    pr.stdin.close(); pr.wait()
    os.remove(apath)
    print("wrote", out, os.path.getsize(out) // 1024, "KB", round(total / FPS, 1), "s")


if __name__ == "__main__":
    main()
