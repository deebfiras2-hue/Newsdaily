# ZOOMED OUT
# Voice casting

Model: **eleven_v3** (stability 0.5, similarity 0.8). Timestamps: `/with-timestamps` works on v3 (tested). Same test line per candidate, all v3. wpm = words / total duration incl. dramatic pauses.

| Candidate | voice_id | Source | wpm | LUFS | True peak | Long silences | Notes |
|---|---|---|---|---|---|---|---|
| Daniel | onwK4e9ZLuTAKqWW03F9 | account (British broadcaster) | 116 | -18.7 | -1.3 | 1 | slow pace (too slow) |
| **Peter** | ZthjuvLPty3kTMaNKVKb | library (added) | 140 | -14.8 | -0.4 | 0 | "confident, reliable, credible narrator"; 5.4B chars/yr, 1.4M clones; no pauses/glitches; hot peak so normalise |
| Christopher | G17SuINrv2H9FC6nvetn | library (added) | 148 | -18.1 | -1.5 | 1 | gentle, trustworthy British; more expressive range but softer authority; runner-up |
| Quentin | Aa6nEBJJMKJwJkCx8VU2 | library (added) | 141 | -18.2 | -1.3 | 2 | deep narrator/educator |
| Eric | cjVigY5qzO86Huf0OWal | account | 147 | -18.5 | -2.7 | 1 | smooth, more conversational than news |

**Winner: Peter.** Credible narrator profile, steady mid pace, most usage, cleanest delivery.

**Quote voice (opposite gender): Alice (Xb7hH8MSUJpSbSDYk0k2), clear British educator.** Tested on a short quote line (peak -4 dB, clean).

Caveat: scores are objective only (no listening possible). Please listen to the WINNER mp3 and swap via config/voice.json if it is not right; other samples are in `samples/`.
