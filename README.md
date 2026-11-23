# ZOOMED OUT content desk (Instagram @zoomed.out.365)

*The big picture. Every day.* Daily news carousels (1080x1350 JPEG) and reels (1080x1920 MP4).

- Brand: `tools/brand.py` (HANDLE, colors, viewfinder icon, wordmark). Colors #0B0B0F / #FF2D2D / #FFFFFF; fonts Anton + Inter in `fonts/`.
- Carousels: `tools/render.py spec.json`; reels: `tools/reel.py spec.json`; specs in `specs/`.
- Env secrets (never committed): `ELEVENLABS_API_KEY`, `PEXELS_API_KEY`. Voiced-reel pipeline (voice, word captions, Pexels, SFX) is still TODO: needs valid keys.

- Today: [posts/2026-11-23](posts/2026-11-23/captions.md)