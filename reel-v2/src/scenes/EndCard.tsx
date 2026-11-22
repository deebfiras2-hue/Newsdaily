import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER, W, H} from '../theme';
import {clamp, ease, lerp, pop, prog} from '../lib/anim';
import {Brackets} from '../components/Brackets';
import {Starfield} from '../components/Starfield';
import {Sfx} from '../spec';

export type EndProps = {handle?: string; tagline?: string; cta?: string; dur: number};

/** Branded outro: the viewfinder ZOOMS OUT from full-screen to the logo, dot pops, wordmark + handle. */
export const EndCard: React.FC<EndProps> = ({handle = '@zoomed.out.365', tagline = 'The big picture. Every day.', cta = 'FOLLOW'}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const z = ease.inOut(clamp(f / 20));
  const S = 210;
  const cx = W / 2, cy = 700;
  const w = lerp(W - 40, S, z), h = lerp(H - 40, S, z);
  const st = lerp(18, 0.08 * S, z);
  const arm = lerp(240, 0.31 * S, z);
  const dot = pop(f, fps, 18, 420, 14);
  const wm = prog(f, 22, 36, ease.out);
  const cIn = pop(f, fps, 34, 260, 18);
  const tg = prog(f, 44, 58);
  const glow = 0.25 + 0.1 * Math.sin(t * 3);
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 38%, #1A1A22 0%, ${C.bg} 62%)`}}>
      <Starfield zoom={1 + (1 - z) * 2} drift={t} opacity={0.45} seed={21} />
      <Brackets x={cx - w / 2} y={cy - h / 2} w={w} h={h} arm={arm} stroke={st} dot={0} />
      {f >= 18 && <div style={{position: 'absolute', left: cx - 0.12 * S * dot, top: cy - 0.12 * S * dot, width: 0.24 * S * dot, height: 0.24 * S * dot, borderRadius: '50%', background: C.white, boxShadow: `0 0 40px rgba(255,255,255,${glow})`}} />}
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + S / 2 + 60, textAlign: 'center', clipPath: `inset(0 ${(1 - wm) * 50}% 0 ${(1 - wm) * 50}%)`}}>
        <span style={{fontFamily: ANTON, fontSize: 150, letterSpacing: 10, color: C.white}}>ZOOMED </span>
        <span style={{fontFamily: ANTON, fontSize: 150, letterSpacing: 10, color: C.red}}>OUT</span>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + S / 2 + 290, display: 'flex', justifyContent: 'center', opacity: clamp(cIn * 1.4), transform: `translateY(${(1 - cIn) * 40}px) scale(${0.9 + 0.1 * cIn})`}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 18, background: C.red, borderRadius: 999, padding: '20px 44px', boxShadow: '0 16px 50px rgba(255,45,45,0.35)'}}>
          <span style={{fontFamily: INTER, fontWeight: 900, fontSize: 40, letterSpacing: 3, color: C.white}}>{cta}</span>
          <span style={{fontFamily: INTER, fontWeight: 700, fontSize: 40, color: C.white}}>{handle}</span>
        </div>
      </div>
      <div style={{position: 'absolute', left: 0, right: 0, top: cy + S / 2 + 430, textAlign: 'center', fontFamily: INTER, fontWeight: 600, fontSize: 34, letterSpacing: 2, color: C.gray, opacity: tg}}>{tagline}</div>
    </AbsoluteFill>
  );
};

export const endCues = (): Sfx[] => [
  {src: 'sfx/whoosh-deep.mp3', at: 0.0, volume: 0.45},
  {src: 'sfx/news-sting.mp3', at: 0.55, volume: 0.4},
  {src: 'sfx/pop.mp3', at: 34 / 30, volume: 0.45},
];
