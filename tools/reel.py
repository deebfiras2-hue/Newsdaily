#!/usr/bin/env python3
"""ZOOMED OUT reel renderer (1080x1920, 30fps, H.264, silent AAC track unless voiced).
Usage: python3 tools/reel.py spec.json

Spec:
{
 "out": "posts/2026-11-22/reels/reel-1.mp4",
 "cover": "posts/2026-11-22/reels/reel-1-cover.png",
 "category": "MONEY", "tag": "BREAKING",
 "hook": {"text": "...", "highlight": ["..."], "photo": "path", "focus": [0.5,0.3]},
 "beats": [{"text": "...", "red": ["word"], "photo": "path|null", "focus": [x,y]}],
 "hook_sec": 3.2, "beat_sec": 3.4, "outro_sec": 2.8
}
"""
import json, os, re, shutil, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render as R

W, H, FPS = 1080, 1920, 30
BG, RED, WHITE, GRAY, MUTED = R.BG, R.RED, R.WHITE, R.GRAY, R.MUTED
ROOT = R.ROOT
FADE = 8


def ff_exe():
    p = shutil.which("ffmpeg")
    if p:
        return p
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def ease(t):
    t = max(0.0, min(1.0, t))
    return 1 - (1 - t) ** 3


def grid_bg():
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    for x in range(0, W, 54):
        d.line([(x, 0), (x, H)], fill=(24, 24, 31))
    for y in range(0, H, 54):
        d.line([(0, y), (W, y)], fill=(24, 24, 31))
    g = Image.new("L", (W, H), 0)
    ImageDraw.Draw(g).ellipse([W - 560, -200, W + 360, 720], fill=100)
    g = g.filter(ImageFilter.GaussianBlur(200))
    return Image.composite(Image.new("RGB", (W, H), RED), img, g)


def load(path):
    p = path if os.path.isabs(path) else os.path.join(ROOT, path)
    return Image.open(p).convert("RGB")


class Scene:
    def __init__(self, kind, dur, photo=None, focus=(0.5, 0.4), text=None, red=None, flip=1, pills=None):
        self.kind, self.dur, self.flip = kind, dur, flip
        self.n = int(round(dur * FPS))
        self.pills = pills
        self.base = None
        if photo:
            im = load(photo)
            iw, ih = im.size
            s = max(W / iw, H / ih) * 1.18  # headroom for zoom/pan
            s = max(s, 1.0) if iw * s < W * 1.1 else s
            self.base = im.resize((int(iw * s), int(ih * s)), Image.LANCZOS)
            self.focus = focus
        else:
            self.bgimg = grid_bg()
        self.shade = self._shade()
        self.text_layer = None
        if text:
            self.text_layer = self._text(text, red or [], kind)

    def _shade(self):
        keys = [(0, 0.60), (400, 0.42), (800, 0.50), (1300, 0.55), (1600, 0.78), (H, 0.88)]
        if self.kind == "hook":
            keys = [(0, 0.55), (350, 0.30), (700, 0.40), (1100, 0.70), (1500, 0.88), (H, 0.92)]
        a = R.grad_alpha(H, keys)
        return Image.fromarray((np.tile(a[:, None], (1, W)) * 255).astype("uint8"), "L")

    def _text(self, text, red, kind):
        size0 = 150 if kind == "hook" else 118
        words, hl, lines, font, size = R.fit_headline(text, red, 3, size0, 64, 900)
        lh = 1.04
        total = len(lines) * int(size * lh)
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        # vertical position: hook lower-middle, beats centered in the middle third
        cy = 1170 if kind == "hook" else 960
        top = cy - total // 2
        # shadow
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        d = ImageDraw.Draw(layer)
        yy = top
        for ln in lines:
            lw = sum(font.getlength(words[i] + " ") for i in ln) - font.getlength(" ")
            xx = (W - lw) / 2
            for i in ln:
                sd.text((xx, yy + size), words[i], font=font, fill=(0, 0, 0, 200), anchor="ls")
                d.text((xx, yy + size), words[i], font=font, fill=RED if i in hl else WHITE, anchor="ls")
                xx += font.getlength(words[i] + " ")
            yy += int(size * lh)
        sh = sh.filter(ImageFilter.GaussianBlur(9))
        out = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        out.paste(sh, (0, 7), sh)
        out = Image.alpha_composite(out, layer)
        # red accent bar under text
        od = ImageDraw.Draw(out)
        bx = (W - 130) // 2
        od.rectangle([bx, top + total + 26, bx + 130, top + total + 34], fill=RED + (255,))
        self.text_center = (W // 2, top + total // 2)
        return out

    def frame(self, k):
        """render frame k (0..n-1+) of this scene"""
        t = k / max(1, self.n)
        if self.kind == "outro":
            return self._outro(k)
        if self.base is not None:
            z = 1.0 + 0.14 * t if self.flip > 0 else 1.14 - 0.14 * t
            bw, bh = self.base.size
            cw, ch = bw / 1.18 / z * 1.0, bh / 1.18 / z * 1.0
            # crop box in base coords with focus-based pan
            fx, fy = self.focus
            px = fx * bw
            py = fy * bh
            drift = (t - 0.5) * 0.05 * bw * (1 if self.flip > 0 else -1)
            cx = px + drift
            x0 = min(max(cx - cw / 2, 0), bw - cw)
            y0 = min(max(py - ch * (0.26 if self.kind == 'hook' else 0.40), 0), bh - ch)
            img = self.base.resize((W, H), Image.BILINEAR, box=(x0, y0, x0 + cw, y0 + ch))
            img = Image.composite(Image.new("RGB", (W, H), BG), img, self.shade)
        else:
            img = self.bgimg.copy()
        if self.text_layer is not None:
            p = ease(k / 9.0)
            if p < 1:
                s = 0.82 + 0.18 * p
                lay = self.text_layer.resize((int(W * s), int(H * s)), Image.BILINEAR)
                a = lay.getchannel("A").point(lambda v: int(v * p))
                lay.putalpha(a)
                cx, cy = self.text_center
                ox = int(cx - cx * s)
                oy = int(cy - cy * s)
                img.paste(lay, (ox, oy), lay)
            else:
                img.paste(self.text_layer, (0, 0), self.text_layer)
        if self.pills:
            pimg = img.convert("RGBA")
            # reuse render.pills at y offset using a temp canvas
            tmp = Image.new("RGB", (W, 1350), (0, 0, 0))
            R.pills(pimg, *self.pills) if False else None
        return img

    def _outro(self, k):
        import brand
        img = self.bgimg.copy()
        d = ImageDraw.Draw(img)
        p = ease(k / 20.0)
        S = int(520 - 260 * p)  # viewfinder zooms out
        brand.draw_icon(img, (W - S) // 2, 520 - S // 2, S)
        y0 = 900
        f = R.anton(104)
        wz, wo = R.spaced_len("ZOOMED", f, 3), R.spaced_len("OUT", f, 3)
        x = (W - wz - wo - 28) / 2
        R.spaced(d, (x, y0), "ZOOMED", f, WHITE, 3)
        R.spaced(d, (x + wz + 28, y0), "OUT", f, RED, 3)
        ft = R.inter(36, 700)
        t = "THE BIG PICTURE. EVERY DAY."
        R.spaced(d, ((W - R.spaced_len(t, ft, 5)) / 2, y0 + 90), t, ft, GRAY, 5)
        fh = R.anton(60)
        t = "FOLLOW " + brand.HANDLE.upper()
        d.rounded_rectangle([(W - fh.getlength(t)) / 2 - 36, y0 + 170, (W + fh.getlength(t)) / 2 + 36, y0 + 270], radius=50, fill=RED)
        d.text(((W - fh.getlength(t)) / 2, y0 + 240), t, font=fh, fill=WHITE, anchor="ls")
        return img


def add_intro(img, g):
    """first 3s: viewfinder icon top-right; 0.5s: brackets zoom out around hook"""
    import brand
    if g < 3 * FPS:
        brand.draw_icon(img, W - 72 - 90, 190, 90)
    if g < 15:
        k = ease(g / 15.0)
        sc = 0.6 + 0.4 * k
        S = int(820 * sc)
        lay = Image.new("RGB", img.size, (0, 0, 0))
        m = Image.new("L", img.size, 0)
        brand.draw_icon(lay, (W - S) // 2, 1170 - S // 2, S, dot=False)
        md = Image.new("L", img.size, 0)
        brand.draw_icon(Image.new("RGB", img.size), 0, 0, 1)
        # simple: draw directly (brackets only)
        brand.draw_icon(img, (W - S) // 2, 1170 - S // 2, S, dot=False)


def add_pills(img, category, tag):
    # pills are drawn by render.pills at (72,72); draw on a crop so the layout lands at y~250
    reg = img.crop((0, 178, W, 420))
    R.pills(reg, category, tag)
    img.paste(reg, (0, 178))


def progress(img, frac):
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, W, 10], fill=(40, 40, 48))
    d.rectangle([0, 0, int(W * frac), 10], fill=RED)


def main():
    spec = json.load(open(sys.argv[1]))
    out = spec["out"] if os.path.isabs(spec["out"]) else os.path.join(ROOT, spec["out"])
    cover = spec.get("cover")
    cover = cover if (cover is None or os.path.isabs(cover)) else os.path.join(ROOT, cover)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    cat, tag = spec.get("category", "NEWS"), spec.get("tag", "BREAKING")
    h = spec["hook"]
    scenes = [Scene("hook", spec.get("hook_sec", 3.2), h.get("photo"), tuple(h.get("focus", (0.5, 0.35))), h["text"], h.get("highlight", []), 1)]
    for i, b in enumerate(spec["beats"]):
        scenes.append(Scene("beat", spec.get("beat_sec", 3.4), b.get("photo"), tuple(b.get("focus", (0.5, 0.4))), b["text"], b.get("red", []), 1 if i % 2 == 0 else -1))
    scenes.append(Scene("outro", spec.get("outro_sec", 2.8)))
    total = sum(s.n for s in scenes)
    print("frames", total, "seconds", round(total / FPS, 1))

    def render_global(g):
        acc = 0
        for si, s in enumerate(scenes):
            if g < acc + s.n:
                k = g - acc
                img = s.frame(k)
                if si > 0 and k < FADE:
                    prev = scenes[si - 1].frame(scenes[si - 1].n + k)
                    img = Image.blend(prev, img, (k + 1) / (FADE + 1))
                if s.kind in ("hook", "beat"):
                    pass
                if s.kind == "hook":
                    add_pills(img, cat, tag)
                    add_intro(img, g)
                progress(img, (g + 1) / total)
                return img
            acc += s.n

    if cover:
        c = render_global(int(0.5 * FPS) + 8)  # fully popped-in hook frame
        c.save(cover, quality=95)
        print("cover", cover)

    cmd = [ff_exe(), "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
           "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-shortest", "-c:a", "aac", "-b:a", "128k", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", str(FPS), out]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for g in range(total):
        pr.stdin.write(render_global(g).tobytes())
    pr.stdin.close()
    pr.wait()
    print("wrote", out, os.path.getsize(out) // 1024, "KB")


if __name__ == "__main__":
    main()
