"""ZOOMED OUT brand constants + viewfinder icon."""
from PIL import ImageDraw
NAME = "ZOOMED OUT"
TAGLINE = "The big picture. Every day."
HANDLE = "@zoomed.out.365"
BG = (11, 11, 15); RED = (255, 45, 45); WHITE = (255, 255, 255)
BODY = (201, 201, 209); MUTED = (138, 138, 149)


def draw_icon(img, x, y, S, dot=True):
    """Viewfinder: 4 red L brackets + white center dot. (x,y)=top-left of square S."""
    d = ImageDraw.Draw(img)
    arm, st = int(0.31 * S), max(2, int(round(0.08 * S)))
    x2, y2 = x + S, y + S
    for cx, cy, sx, sy in ((x, y, 1, 1), (x2, y, -1, 1), (x, y2, 1, -1), (x2, y2, -1, -1)):
        hx0, hx1 = sorted((cx, cx + sx * arm)); 
        d.rectangle([hx0, (cy if sy > 0 else cy - st), hx1, (cy + st if sy > 0 else cy)], fill=RED)
        vy0, vy1 = sorted((cy, cy + sy * arm))
        d.rectangle([(cx if sx > 0 else cx - st), vy0, (cx + st if sx > 0 else cx), vy1], fill=RED)
    if dot:
        r = 0.12 * S; mx, my = x + S / 2, y + S / 2
        d.ellipse([mx - r, my - r, mx + r, my + r], fill=WHITE)


def wordmark(img, x, base_y, icon=40, size=40, track=3):
    """icon + ZOOMED(white) OUT(red); returns right x."""
    from render import anton, spaced
    draw_icon(img, x, base_y - icon + 2, icon)
    d = ImageDraw.Draw(img); f = anton(size)
    xx = x + icon + 14
    w = spaced(d, (xx, base_y), "ZOOMED", f, WHITE, track)
    xx += w + 14
    w2 = spaced(d, (xx, base_y), "OUT", f, RED, track)
    return xx + w2
