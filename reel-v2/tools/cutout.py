#!/usr/bin/env python3
"""Foreground cut-out for 2.5D parallax photo cards.
usage: python3.13 tools/cutout.py IN.jpg OUT_fg.png   (needs: pip install rembg onnxruntime)
Writes an RGBA PNG (same size as input) with the subject only; the PhotoCard
scene layers it over the blurred/pushed original for depth."""
import sys
from PIL import Image
from rembg import remove, new_session

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
out = remove(im, session=new_session("isnet-general-use"), alpha_matting=False)
out.save(dst)
print("wrote", dst, out.size)
