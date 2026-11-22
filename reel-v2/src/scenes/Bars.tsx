import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER} from '../theme';
import {ease, pop, prog} from '../lib/anim';
import {Kicker} from '../components/Callout';
import {Brackets} from '../components/Brackets';
import {Sfx} from '../spec';

export type BarsProps = {
  title?: string;
  kicker?: string;
  bars: {label: string; sub?: string; value: number; unit?: string; highlight?: boolean; decimals?: number}[];
  max?: number;
  badge?: {text: string; at: number};
  source?: string;
  stagger?: number;
  dur: number;
};

export const Bars: React.FC<BarsProps> = ({title, kicker, bars, max, badge, source, stagger = 0.35}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const mx = max ?? Math.max(...bars.map((b) => b.value)) * 1.08;
  const MAXW = 760;
  const top = 640;
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 70% at 30% 40%, #17171E 0%, ${C.bg} 70%)`}}>
      <div style={{position: 'absolute', left: 64, right: 64, top: 360, opacity: prog(f, 0, 12)}}>
        {kicker && <Kicker text={kicker} />}
        {title && <div style={{fontFamily: ANTON, fontSize: 92, color: C.white, letterSpacing: 2, lineHeight: 1.05, marginTop: 8}}>{title}</div>}
      </div>
      {bars.map((b, i) => {
        const st = (0.15 + i * stagger) * fps;
        const g = prog(f, st, st + 0.85 * fps, ease.out);
        const lin = prog(f, st - 4, st + 6);
        const w = (b.value / mx) * MAXW * g;
        const y = top + i * 230;
        const col = b.highlight ? C.red : '#3A3A46';
        return (
          <div key={i} style={{position: 'absolute', left: 64, top: y}}>
            <div style={{fontFamily: INTER, fontWeight: 800, fontSize: 34, letterSpacing: 4, color: b.highlight ? C.white : C.gray, opacity: lin, transform: `translateX(${(1 - lin) * -20}px)`}}>
              {b.label}
              {b.sub && <span style={{fontWeight: 600, color: C.muted, marginLeft: 14, letterSpacing: 2, fontSize: 28}}>{b.sub}</span>}
            </div>
            <div style={{position: 'relative', marginTop: 14, height: 96, width: w, background: col, boxShadow: b.highlight ? '0 0 40px rgba(255,45,45,0.35)' : 'none'}} />
            <div style={{position: 'absolute', top: 58, left: w + 22, fontFamily: ANTON, fontSize: 84, lineHeight: '96px', color: C.white, letterSpacing: 2, opacity: lin, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
              {(b.value * g).toFixed(b.decimals ?? 0)}
              {b.unit && <span style={{fontSize: 44, color: b.highlight ? C.red : C.gray, marginLeft: 10}}>{b.unit}</span>}
            </div>
          </div>
        );
      })}
      {badge && f >= badge.at * fps && (() => {
        const s = pop(f, fps, badge.at * fps, 460, 16);
        const bw = 620, bh = 120, bx = 540 - bw / 2, by = top + bars.length * 230 + 20;
        return (
          <div style={{position: 'absolute', inset: 0, transform: `scale(${1.6 - 0.6 * s})`, transformOrigin: `540px ${by + bh / 2}px`, opacity: Math.min(1, s * 1.5)}}>
            <Brackets x={bx} y={by} w={bw} h={bh} arm={34} stroke={8} />
            <div style={{position: 'absolute', left: bx, top: by, width: bw, height: bh, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: ANTON, fontSize: 62, letterSpacing: 4, color: C.white}}>
              {badge.text}
            </div>
          </div>
        );
      })()}
      {source && <div style={{position: 'absolute', bottom: 440, left: 64, fontFamily: INTER, fontWeight: 600, fontSize: 22, letterSpacing: 2, color: C.muted}}>{source}</div>}
    </AbsoluteFill>
  );
};

export const barsCues = (p: BarsProps): Sfx[] => {
  const out: Sfx[] = p.bars.map((_, i) => ({src: 'sfx/pop.mp3', at: 0.15 + i * (p.stagger ?? 0.35), volume: 0.4}));
  if (p.badge) out.push({src: 'sfx/snap.mp3', at: p.badge.at - 0.02, volume: 0.55});
  return out;
};
