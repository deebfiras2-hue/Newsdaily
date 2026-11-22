#!/usr/bin/env python3
"""ZOOMED OUT carousel renderer.  Usage: python3 tools/render.py spec.json

Spec (JSON):
{
  "out": "posts/2026-11-22/1-slug",          # output folder
  "date": "NOV 22, 2026",
  "category": "MONEY",                         # red pill
  "tag": "TODAY",                              # dark pill ('BREAKING' / 'TODAY')
  "source": "Reuters, AP",                     # shown on cover 'Source: ...'
  "slides": [
    {"type":"cover","photo":"path|null","focus":[0.5,0.3],
     "headline":"...","highlight":["phrase"],"subline":"**Bold** rest",
     "credit":"Author / CC BY 2.0"},
    {"type":"inner","photo":"path|null","focus":[0.5,0.4],
     "kicker":"WHAT HAPPENED","body":"text with **white bold** and [[red words]]",
     "credit":"Author / CC BY 2.0"}
  ]
}
"""
import json, os, re, sys
import numpy as np
sys_path=os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0,sys_path)
import brand
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1350
BG = (11, 11, 15)
RED = (255, 45, 45)
GRAY = (201, 201, 209)
MUTED = (138, 138, 149)
WHITE = (255, 255, 255)
M = 72
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "fonts")


def anton(size):
    p = os.path.join(FONTS, "Anton-Regular.ttf")
    try:
        return ImageFont.truetype(p, size)
    except Exception:
        return ImageFont.truetype("DejaVuSans-Bold.ttf", size)


_inter_cache = {}


def inter(size, wght=400):
    k = (size, wght)
    if k in _inter_cache:
        return _inter_cache[k]
    p = os.path.join(FONTS, "Inter.ttf")
    try:
        f = ImageFont.truetype(p, size)
        try:
            f.set_variation_by_axes([min(32, max(14, size * 0.5)), wght])
        except Exception:
            pass
    except Exception:
        f = ImageFont.truetype("DejaVuSans-Bold.ttf" if wght >= 600 else "DejaVuSans.ttf", size)
    _inter_cache[k] = f
    return f


# ---------------------------------------------------------------- helpers
def spaced(draw, xy, text, font, fill, track=0, anchor="ls"):
    """draw text with letter-spacing; returns width. anchor ls only."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill, anchor="ls")
        x += font.getlength(ch) + track
    return x - xy[0] - track


def spaced_len(text, font, track):
    return sum(font.getlength(c) for c in text) + track * (len(text) - 1)


def cover_crop(img, w, h, focus=(0.5, 0.35), fy_target=0.33):
    iw, ih = img.size
    s = max(w / iw, h / ih)
    rw, rh = int(round(iw * s)), int(round(ih * s))
    im = img.resize((rw, rh), Image.LANCZOS)
    ox = int(round(focus[0] * rw - w * 0.5))
    oy = int(round(focus[1] * rh - h * fy_target))
    ox = max(0, min(rw - w, ox))
    oy = max(0, min(rh - h, oy))
    return im.crop((ox, oy, ox + w, oy + h))


def grad_alpha(h, keys):
    """keys: [(y, alpha 0..1)...] -> numpy column of alpha"""
    ys = np.arange(h)
    ks = [k[0] for k in keys]
    vs = [k[1] for k in keys]
    return np.interp(ys, ks, vs)


def overlay_gradient(base, keys, color=BG):
    a = grad_alpha(base.size[1], keys)
    mask = Image.fromarray((np.tile(a[:, None], (1, base.size[0])) * 255).astype("uint8"), "L")
    solid = Image.new("RGB", base.size, color)
    return Image.composite(solid, base, mask)


def bg_grid_glow(glow_xy=(W - 120, 120), glow_r=520, strength=0.38):
    img = Image.new("RGB", (W, H), BG)
    # faint grid
    d = ImageDraw.Draw(img)
    gc = (24, 24, 31)
    for x in range(0, W, 54):
        d.line([(x, 0), (x, H)], fill=gc, width=1)
    for y in range(0, H, 54):
        d.line([(0, y), (W, y)], fill=gc, width=1)
    # red glow
    glow = Image.new("L", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([glow_xy[0] - glow_r, glow_xy[1] - glow_r, glow_xy[0] + glow_r, glow_xy[1] + glow_r], fill=int(255 * strength))
    glow = glow.filter(ImageFilter.GaussianBlur(190))
    img = Image.composite(Image.new("RGB", (W, H), RED), img, glow)
    return img


# ---------------------------------------------------------------- text wrapping
def balanced_wrap(words, font, maxw, nlines=None, track=0):
    """words: list of str. Return lines (list of list of idx). Minimizes raggedness."""
    sp = font.getlength(" ")
    wl = [font.getlength(w) for w in words]
    n = len(words)

    def width(i, j):  # words i..j-1
        return sum(wl[i:j]) + sp * (j - i - 1)

    INF = 1e18
    if nlines is None:
        # greedy count
        cnt, cur = 1, 0
        for i in range(n):
            add = wl[i] + (sp if cur else 0)
            if cur + add > maxw and cur:
                cnt += 1
                cur = wl[i]
            else:
                cur += add
        nlines = cnt
    best = {}

    def solve(i, k):
        if (i, k) in best:
            return best[(i, k)]
        if k == 1:
            wd = width(i, n)
            r = ((maxw - wd) ** 2 if wd <= maxw else INF, [n])
            best[(i, k)] = r
            return r
        res = (INF, None)
        for j in range(i + 1, n - k + 2):
            wd = width(i, j)
            if wd > maxw:
                break
            sub = solve(j, k - 1)
            cost = (maxw - wd) ** 2 * 0.35 + sub[0]
            if cost < res[0]:
                res = (cost, [j] + sub[1])
        best[(i, k)] = res
        return res

    cost, cuts = solve(0, nlines)
    if cuts is None or cost >= INF / 2:
        return None
    lines, i = [], 0
    for c in cuts:
        lines.append(list(range(i, c)))
        i = c
    return lines


def fit_headline(text, highlight, max_lines=3, start=112, minsize=60, maxw=W - 2 * M):
    words = text.upper().split()
    hl = set()
    for ph in highlight or []:
        pw = ph.upper().split()
        for i in range(len(words) - len(pw) + 1):
            if [re.sub(r"[^\w$%'’-]", "", x) for x in words[i:i + len(pw)]] == [re.sub(r"[^\w$%'’-]", "", x) for x in pw] or words[i:i + len(pw)] == pw:
                hl.update(range(i, i + len(pw)))
    for size in range(start, minsize - 1, -2):
        f = anton(size)
        for nl in range(1, max_lines + 1):
            lines = balanced_wrap(words, f, maxw, nl)
            if lines and not (len(lines) > 1 and len(lines[-1]) == 1 and len(words) > 3 and nl > 1 and False):
                # no orphan: last line must have >=2 words if >1 line (unless only 2 words total)
                if len(lines) > 1 and len(lines[-1]) < 2 and len(words) >= 4:
                    continue
                return words, hl, lines, f, size
    f = anton(minsize)
    lines = balanced_wrap(words, f, maxw, max_lines) or [list(range(len(words)))]
    return words, hl, lines, f, minsize


def draw_headline(img, words, hl, lines, font, y_top, lh=1.0, shadow=True, x=M):
    size = font.size
    step = int(size * lh)
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sd = ImageDraw.Draw(sh)
        yy = y_top
        for ln in lines:
            xx = x
            for i in ln:
                sd.text((xx, yy + size), words[i], font=font, fill=(0, 0, 0, 150), anchor="ls")
                xx += font.getlength(words[i] + " ")
            yy += step
        sh = sh.filter(ImageFilter.GaussianBlur(6))
        img.paste(sh, (0, 5), sh)
    d = ImageDraw.Draw(img)
    yy = y_top
    for ln in lines:
        xx = x
        for i in ln:
            d.text((xx, yy + size), words[i], font=font, fill=RED if i in hl else WHITE, anchor="ls")
            xx += font.getlength(words[i] + " ")
        yy += step
    return yy


# rich text: **bold**, [[red]]
def parse_rich(text):
    toks = []
    for m in re.finditer(r"\*\*(.+?)\*\*|\[\[(.+?)\]\]|([^*\[]+|[*\[])", text):
        if m.group(1) is not None:
            style, s = "b", m.group(1)
        elif m.group(2) is not None:
            style, s = "r", m.group(2)
        else:
            style, s = "n", m.group(3)
        for w in re.findall(r"\S+|\s+", s):
            if w.isspace():
                toks.append((" ", style))
            else:
                toks.append((w, style))
    # merge adjacent word fragments without spaces into words
    words, cur = [], []
    for w, st in toks:
        if w == " ":
            if cur:
                words.append(cur)
                cur = []
        else:
            cur.append((w, st))
    if cur:
        words.append(cur)
    return words  # list of words; word = list of (frag, style)


def rich_font(style, size, base_w=400):
    if style == "n":
        return inter(size, base_w)
    return inter(size, 700 if style == "b" else 800)


def rich_color(style, base=GRAY):
    return {"n": base, "b": WHITE, "r": RED}[style]


def word_len(word, size):
    return sum(rich_font(st, size).getlength(f) for f, st in word)


def wrap_rich(words, size, maxw):
    sp = inter(size, 400).getlength(" ")
    lines, cur, cw = [], [], 0
    for w in words:
        wl = word_len(w, size)
        add = wl + (sp if cur else 0)
        if cur and cw + add > maxw:
            lines.append(cur)
            cur, cw = [w], wl
        else:
            cur.append(w)
            cw += add
    if cur:
        lines.append(cur)
    # avoid orphan last word: pull a word down if last line has 1 word
    if len(lines) > 1 and len(lines[-1]) == 1 and len(lines[-2]) > 2:
        lines[-1].insert(0, lines[-2].pop())
    return lines


def draw_rich(img, text, x, y, size, maxw, lh=1.42, maxy=None, minsize=30, base_color=GRAY):
    words = parse_rich(text)
    while True:
        lines = wrap_rich(words, size, maxw)
        h = len(lines) * int(size * lh)
        if maxy is None or y + h <= maxy or size <= minsize:
            break
        size -= 2
    d = ImageDraw.Draw(img)
    sp = inter(size, 400).getlength(" ")
    yy = y
    for ln in lines:
        xx = x
        for w in ln:
            for frag, st in w:
                d.text((xx, yy + size), frag, font=rich_font(st, size), fill=rich_color(st, base_color), anchor="ls")
                xx += rich_font(st, size).getlength(frag)
            xx += sp
        yy += int(size * lh)
    return yy, size


# ---------------------------------------------------------------- UI pieces
def pills(img, category, tag):
    over = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(over)
    f = anton(30)
    track = 4
    tw = spaced_len(category, f, track)
    pw, ph = int(tw + 52), 56
    d.rounded_rectangle([M, M, M + pw, M + ph], radius=ph // 2, fill=RED + (255,))
    spaced(d, (M + 26, M + 41), category, f, WHITE, track)
    # dark pill
    f2 = inter(22, 800)
    t2 = spaced_len(tag, f2, 3)
    x0 = M + pw + 16
    p2w = int(t2 + 90)
    d.rounded_rectangle([x0, M, x0 + p2w, M + ph], radius=ph // 2, fill=(0, 0, 0, 150))
    # glowing dot
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    cx, cy = x0 + 32, M + ph // 2
    gd.ellipse([cx - 12, cy - 12, cx + 12, cy + 12], fill=RED + (255,))
    glow = glow.filter(ImageFilter.GaussianBlur(7))
    over = Image.alpha_composite(over, glow)
    d = ImageDraw.Draw(over)
    d.ellipse([cx - 7, cy - 7, cx + 7, cy + 7], fill=RED + (255,))
    spaced(d, (x0 + 56, M + 36), tag, f2, WHITE, 3)
    img.paste(over, (0, 0), over)


def footer(img, date, counter=None, swipe=False):
    d = ImageDraw.Draw(img)
    base_y = H - M  # baseline
    d.line([(M, base_y - 56), (W - M, base_y - 56)], fill=(52, 52, 62), width=2)
    brand.wordmark(img, M, base_y, 40, 40, 3)
    d = ImageDraw.Draw(img)
    fd = inter(24, 700)
    right = counter if counter else ("" if swipe else date)
    tw = spaced_len(right, fd, 3) if right else 0
    if right:
        spaced(d, (W - M - tw, base_y - 6), right, fd, MUTED if counter else GRAY, 3)
    if swipe:
        fs = inter(22, 800)
        t = "SWIPE"
        tw2 = spaced_len(t, fs, 4)
        ax = W - M - 16
        spaced(d, (ax - 14 - tw2, base_y - 6), t, fs, WHITE, 4)
        d.line([(ax, base_y - 24), (ax + 12, base_y - 15), (ax, base_y - 6)], fill=RED, width=4, joint="curve")
    if False:
        fm = inter(20, 600)
        t = date
        tw3 = spaced_len(t, fm, 3)
        spaced(d, (W // 2 - tw3 / 2 + 30, base_y - 6), t, fm, (90, 90, 100), 3)


def fit_line(text, size, maxw, weight=400):
    while size > 14 and inter(size, weight).getlength(text) > maxw:
        size -= 1
    return size


# ---------------------------------------------------------------- slide builders
def load_photo(path):
    if not path:
        return None
    p = path if os.path.isabs(path) else os.path.join(ROOT, path)
    return Image.open(p).convert("RGB")


def build_cover(sl, spec):
    photo = load_photo(sl.get("photo"))
    f_sub = 36
    # --- measure bottom block
    base_y = H - M
    div_y = base_y - 56
    src = "Source: " + spec["source"]
    if sl.get("credit"):
        src += "  |  Photo: " + sl["credit"]
    srcsize = fit_line(src, 22, W - 2 * M)
    src_y = div_y - 24  # baseline
    # subline
    subwords = parse_rich(sl["subline"])
    # first phrase bold handled by author via **..**
    sub_lines = wrap_rich(subwords, f_sub, W - 2 * M)
    while len(sub_lines) > 2 and f_sub > 28:
        f_sub -= 1
        sub_lines = wrap_rich(subwords, f_sub, W - 2 * M)
    sub_lh = int(f_sub * 1.32)
    sub_h = sub_lines.__len__() * sub_lh
    sub_top = src_y - 22 - 22 - sub_h  # gap before source line
    bar_y = sub_top - 30 - 8
    words, hl, lines, font, size = fit_headline(sl["headline"], sl.get("highlight"), 3, 112 if photo else 140)
    head_h = len(lines) * size
    head_top = bar_y - 34 - head_h
    if photo is None:
        head_top = max(270, head_top) if False else head_top
    # --- background
    if photo:
        img = cover_crop(photo, W, H, tuple(sl.get("focus", (0.5, 0.3))), 0.30)
        keys = [(0, 0.55), (215, 0.0), (485, 0.0), (675, 0.75), (865, 1.0), (H, 1.0)]
        # make sure the gradient is solid before the text starts if headline is tall
        img = overlay_gradient(img, keys)
    else:
        img = bg_grid_glow()
    pills(img, spec["category"], spec.get("tag", "TODAY"))
    brand.draw_icon(img, W - M - 58, M - 1, 58)
    draw_headline(img, words, hl, lines, font, head_top)
    d = ImageDraw.Draw(img)
    d.rectangle([M, bar_y, M + 130, bar_y + 8], fill=RED)
    # subline
    yy = sub_top
    sp = inter(f_sub, 400).getlength(" ")
    for ln in sub_lines:
        xx = M
        for w in ln:
            for frag, st in w:
                fo = inter(f_sub, 700 if st != "n" else 400)
                d.text((xx, yy + f_sub), frag, font=fo, fill=WHITE if st != "n" else (214, 214, 222), anchor="ls")
                xx += fo.getlength(frag)
            xx += sp
        yy += sub_lh
    d.text((M, src_y), src, font=inter(srcsize, 400), fill=MUTED, anchor="ls")
    footer(img, spec["date"], None, swipe=True)
    return img


def build_inner(sl, spec, idx, total):
    photo = load_photo(sl.get("photo"))
    if photo:
        ph = 660
        top = cover_crop(photo, W, ph, tuple(sl.get("focus", (0.5, 0.4))), 0.38)
        img = Image.new("RGB", (W, H), BG)
        top = overlay_gradient(top, [(0, 0.25), (120, 0.0), (390, 0.0), (ph - 1, 1.0)])
        img.paste(top, (0, 0))
        ky = ph + 60
        body_y = ph + 96
        credit = sl.get("credit")
    else:
        img = bg_grid_glow((W - 100, 200), 560, 0.30)
        # text-only: big text, block vertically centred in the free area
        tsize = 54
        words_ = parse_rich(sl["body"])
        while True:
            nl = len(wrap_rich(words_, tsize, W - 2 * M))
            bh = nl * int(tsize * 1.42)
            if bh <= 760 or tsize <= 40:
                break
            tsize -= 2
        total_h = 70 + 40 + bh
        ky = int(150 + (1000 - total_h) / 2) + 46
        body_y = ky + 46
        credit = None
    d = ImageDraw.Draw(img)
    # kicker
    kf = anton(46)
    kt = sl["kicker"].upper()
    kw = spaced(d, (M, ky), kt, kf, RED, 5)
    d.rectangle([M, ky + 16, M + 70, ky + 22], fill=RED)
    maxy = H - M - 56 - 70
    body_start = 42 if photo else tsize
    draw_rich(img, sl["body"], M, body_y + 26, body_start, W - 2 * M, 1.42, maxy)
    if credit:
        c = "Photo: " + credit
        cs = fit_line(c, 18, W - 2 * M)
        d.text((M, H - M - 56 - 14), c, font=inter(cs, 400), fill=(100, 100, 112), anchor="ls")
    if idx == total:
        ft = "Follow " + brand.HANDLE + " for the big picture"
        d.text((M, H - M - 56 - (44 if credit else 16)), ft, font=inter(24, 600), fill=GRAY, anchor="ls")
    footer(img, spec["date"], f"{idx}/{total}")
    if photo:
        pass
    return img


def main():
    spec = json.load(open(sys.argv[1]))
    out = spec["out"]
    out = out if os.path.isabs(out) else os.path.join(ROOT, out)
    os.makedirs(out, exist_ok=True)
    slides = spec["slides"]
    n = len(slides)
    for i, sl in enumerate(slides, 1):
        img = build_cover(sl, spec) if sl["type"] == "cover" else build_inner(sl, spec, i, n)
        p = os.path.join(out, f"{i}.jpg")
        img.save(p, quality=95, subsampling=0)
        print("wrote", p, os.path.getsize(p) // 1024, "KB")


if __name__ == "__main__":
    main()
