import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER, W} from '../theme';
import {KineticProps, Sfx} from '../spec';
import {pop, prog, rand} from '../lib/anim';
import {measure} from '../lib/measure';
import {Brackets} from '../components/Brackets';

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\-]/g, '');

/** Huge Anton words slamming in line by line; key words red; brackets snap around one word. */
const KT: React.FC<KineticProps & {standalone?: boolean}> = ({lines, exitAt, y = 760, size = 190}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const lh = size * 1.02;
  const top = y - (lines.length * lh) / 2;
  const exit = exitAt !== undefined ? prog(f, exitAt * fps, exitAt * fps + 7) : 0;
  // camera shake on each slam
  let sx = 0, sy = 0;
  lines.forEach((l, i) => {
    const d = f - l.at * fps;
    if (d >= 2 && d < 10) {
      const k = (1 - (d - 2) / 8) * 9;
      sx += (rand(f * 3 + i) - 0.5) * k;
      sy += (rand(f * 7 + i) - 0.5) * k;
    }
  });
  return (
    <AbsoluteFill style={{transform: `translate(${sx}px, ${sy}px)`, opacity: 1 - exit}}>
      {lines.map((l, i) => {
        const lf = l.at * fps;
        if (f < lf - 1) return null;
        const s = pop(f, fps, lf, 380, 20);
        const words = l.text.toUpperCase().split(' ');
        const gap = size * 0.22;
        const ws = words.map((w) => measure(w, ANTON, size, 400, 2));
        const total = ws.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
        let x = (W - total) / 2;
        const ly = top + i * lh;
        const red = new Set((l.red ?? []).map(clean));
        const scale = 1.9 - 0.9 * s;
        const blur = Math.max(0, (1 - s) * 14);
        const els: React.ReactNode[] = [];
        words.forEach((w, j) => {
          const isRed = red.has(clean(w));
          els.push(
            <div
              key={j}
              style={{
                position: 'absolute',
                left: x,
                top: ly,
                fontFamily: ANTON,
                fontSize: size,
                lineHeight: `${lh}px`,
                letterSpacing: 2,
                color: isRed ? C.red : C.white,
                textShadow: '0 10px 40px rgba(0,0,0,0.55)',
                whiteSpace: 'nowrap',
              }}
            >
              {w}
            </div>,
          );
          if (l.bracket && clean(l.bracket) === clean(w)) {
            const ba = (l.bracketAt ?? l.at + 0.25) * fps;
            if (f >= ba) {
              const b = pop(f, fps, ba, 500, 22);
              const pad = 28 + (1 - b) * 120;
              els.push(
                <Brackets key={'b' + j} x={x - pad} y={ly + lh * 0.06 - pad} w={ws[j] + pad * 2} h={lh * 0.9 + pad * 2} arm={46} stroke={9} opacity={Math.min(1, b * 1.4)} />,
              );
              if (l.bracketLabel) {
                const lp = prog(f, ba + 5, ba + 15);
                els.push(
                  <div
                    key={'bl' + j}
                    style={{
                      position: 'absolute',
                      left: x - 28,
                      top: ly + lh + 16,
                      fontFamily: INTER,
                      fontWeight: 800,
                      fontSize: 34,
                      letterSpacing: 6,
                      color: C.white,
                      background: C.red,
                      padding: '6px 16px',
                      opacity: lp,
                      transform: `translateY(${(1 - lp) * 14}px)`,
                    }}
                  >
                    {l.bracketLabel}
                  </div>,
                );
              }
            }
          }
          x += ws[j] + gap;
        });
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              transform: `scale(${scale})`,
              transformOrigin: `540px ${ly + lh / 2}px`,
              filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
              opacity: Math.min(1, s * 2),
            }}
          >
            {els}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

export const KineticTitle = Object.assign(KT, {
  cues: (p: KineticProps): Sfx[] => {
    const out: Sfx[] = [];
    p.lines.forEach((l, i) => {
      out.push({src: i === p.lines.length - 1 ? 'sfx/impact-boom.mp3' : 'sfx/hit.mp3', at: l.at - 0.02, volume: i === p.lines.length - 1 ? 0.55 : 0.45});
      if (l.bracket) out.push({src: 'sfx/snap.mp3', at: (l.bracketAt ?? l.at + 0.25) - 0.02, volume: 0.55});
    });
    return out;
  },
});

/** standalone scene version (dark background) */
export const KineticScene: React.FC<KineticProps> = (p) => (
  <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, #1a1a22 0%, ${C.bg} 70%)`}}>
    <KT {...p} />
  </AbsoluteFill>
);
