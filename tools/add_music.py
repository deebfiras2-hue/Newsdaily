#!/usr/bin/env python3
"""Mix a background-music bed under a voiced reel (ZOOMED OUT).

usage: add_music.py IN.mp4 OUT.mp4 --mood tense|curious|uplifting|epic|upbeat|neutral [--track FILE] [--seed N]

Picks a track from assets/music/music.json (or --track), random start offset,
fade in 0.5 s / out 1.5 s, trimmed to video length, ducked under the voice with
sidechaincompress. Video stream is copied; audio is AAC 48 kHz stereo 192k.
"""
import argparse, json, random, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MOODS = ["tense", "curious", "uplifting", "epic", "upbeat", "neutral"]
# Music sits this far below the voice's integrated loudness in pauses; the
# sidechain then pulls it further down while speaking (~ -20 dB total).
PAUSE_OFFSET_DB = 14.0


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def duration(p):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                      "-of", "csv=p=0", str(p)]).stdout.strip())


def voice_lufs(p):
    out = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(p), "-vn", "-af",
               "ebur128", "-f", "null", "-"]).stderr
    m = re.findall(r"I:\s+(-?\d+\.?\d*) LUFS", out)
    return float(m[-1]) if m else -20.0


def main():
    a = argparse.ArgumentParser()
    a.add_argument("inp"); a.add_argument("out")
    a.add_argument("--mood", choices=MOODS, default="neutral")
    a.add_argument("--track"); a.add_argument("--seed", type=int)
    a.add_argument("--pause-offset", type=float, default=PAUSE_OFFSET_DB)
    a = a.parse_args()
    rng = random.Random(a.seed)

    if a.track:
        track = Path(a.track)
        if not track.is_absolute():
            track = ROOT / track
        if not track.exists() and Path(a.track).exists():
            track = Path(a.track)
    else:
        lib = json.loads((ROOT / "assets/music/music.json").read_text())
        pool = [t for t in lib if t["mood"] == a.mood] or lib
        track = ROOT / rng.choice(pool)["file"]

    vd = duration(a.inp)
    td = duration(track)
    loop = td < vd + 1
    start = 0.0 if loop else rng.uniform(0, max(0, td - vd - 0.1))
    vl = voice_lufs(a.inp)
    gain = (vl - a.pause_offset) - (-16.0)  # tracks are normalised to -16 LUFS
    fo = max(0, vd - 1.5)
    print(f"track={track.name} start={start:.1f}s voice={vl:.1f} LUFS music gain={gain:.1f} dB", file=sys.stderr)

    fc = (
        "[0:a]aformat=sample_rates=48000:channel_layouts=stereo,asplit=3[v1][v2][vsc];"
        f"[1:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:{vd:.3f},asetpts=PTS-STARTPTS,"
        f"volume={gain:.2f}dB,afade=t=in:st=0:d=0.5,afade=t=out:st={fo:.3f}:d=1.5[m];"
        # voice-keyed ducking: ~8 dB of extra reduction while speaking, fast attack, slow release
        "[vsc]highpass=f=150,lowpass=f=6000[key];"
        "[m][key]sidechaincompress=threshold=0.02:ratio=6:attack=15:release=450:makeup=1:knee=4[md];"
        "[v1][md]amix=inputs=2:duration=first:normalize=0:dropout_transition=0,"
        "alimiter=limit=0.95:level=disabled[mix];[v2]anullsink"
    )
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", a.inp]
    if loop:
        cmd += ["-stream_loop", "-1"]
    else:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", str(track), "-filter_complex", fc, "-map", "0:v:0", "-map", "[mix]",
            "-c:v", "copy", "-c:a", "aac", "-ar", "48000", "-ac", "2", "-b:a", "192k",
            "-t", f"{vd:.3f}", "-movflags", "+faststart", a.out]
    r = run(cmd)
    if r.returncode:
        sys.exit(r.stderr)
    print("wrote", a.out, file=sys.stderr)


if __name__ == "__main__":
    main()
