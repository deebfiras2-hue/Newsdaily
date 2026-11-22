import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER, W} from '../theme';
import {clamp, ease, pop, prog} from '../lib/anim';
import {measure} from '../lib/measure';
import {resolveSrc} from '../lib/texture';
import {Sfx} from '../spec';

export type CounterProps = {
  value: number;
  from?: number;
  decimals?: number;
  unit?: string;
  label?: string; // kicker above
  sub?: string; // line under
  source?: string;
  at?: number; // count start (s)
  countDur?: number;
  dots?: number; // optional row of N red indicator dots lighting up (e.g. 4 thrusters)
  bg?: string; // optional background image (dimmed)
  dur: number;
};

export const NumberCounter: React.FC<CounterProps> = ({value, from = 0, decimals = 0, unit, label, sub, source, at = 0.15, countDur = 0.9, dots, bg, dur}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const a = at * fps, b = (at + countDur) * fps;
  const p = prog(f, a, b, ease.out);
  const v = from + (value - from) * p;
  const txt = v.toFixed(decimals);
  const finalTxt = value.toFixed(decimals);
  const NS = 400;
  const nw = measure(finalTxt, ANTON, NS, 400, 4);
  const uw = unit ? measure(unit, ANTON, 150, 400, 3) + 26 : 0;
  const x0 = (W - nw - uw) / 2;
  const hit = pop(f, fps, b, 400, 14);
  const punch = f >= b ? 1 + 0.06 * Math.sin(clamp((f - b) / 8) * Math.PI) : 1;
  const ul = prog(f, b, b + 10, ease.out);
  const lIn = prog(f, 0, 12);
  const sIn = prog(f, b + 4, b + 16);
  const drift = f / fps;
  const Y = 640;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {bg && (
        <AbsoluteFill style={{transform: `scale(${1.15 + drift * 0.02})`, filter: 'brightness(0.28) blur(6px) saturate(0.7)'}}>
          <Img src={resolveSrc(bg)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </AbsoluteFill>
      )}
      {/* data grid */}
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(201,201,209,0.06) 2px, transparent 2px), linear-gradient(90deg, rgba(201,201,209,0.06) 2px, transparent 2px)',
          backgroundSize: '90px 90px',
          backgroundPosition: `${-drift * 12}px ${drift * 20}px`,
          maskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 40%, black 0%, transparent 70%)',
        }}
      />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 42%, rgba(255,45,45,${0.1 + 0.14 * hit * (1 - ul * 0.5)}) 0%, rgba(255,45,45,0) 55%)`}} />
      {label && (
        <div style={{position: 'absolute', top: Y - 70, left: 0, right: 0, textAlign: 'center', fontFamily: INTER, fontWeight: 800, fontSize: 36, letterSpacing: 9, color: C.gray, opacity: lIn, transform: `translateY(${(1 - lIn) * 20}px)`}}>
          {label}
        </div>
      )}
      <div style={{position: 'absolute', left: x0, top: Y, transform: `scale(${punch})`, transformOrigin: `${nw / 2}px 200px`, whiteSpace: 'nowrap'}}>
        <span style={{fontFamily: ANTON, fontSize: NS, lineHeight: '440px', letterSpacing: 4, color: C.white, display: 'inline-block', width: nw, textAlign: 'right', fontVariantNumeric: 'tabular-nums'}}>{txt}</span>
        {unit && <span style={{fontFamily: ANTON, fontSize: 150, letterSpacing: 3, color: C.red, marginLeft: 26, opacity: prog(f, a, a + 8)}}>{unit}</span>}
      </div>
      <div style={{position: 'absolute', left: x0, top: Y + 470, height: 14, width: (nw + uw) * ul, background: C.red}} />
      {sub && (
        <div style={{position: 'absolute', top: Y + 520, left: 0, right: 0, textAlign: 'center', fontFamily: ANTON, fontSize: 70, letterSpacing: 3, color: C.white, opacity: sIn, transform: `translateY(${(1 - sIn) * 20}px)`}}>
          {sub}
        </div>
      )}
      {dots && (
        <div style={{position: 'absolute', top: Y + 620, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 26}}>
          {new Array(dots).fill(0).map((_, i) => {
            const d = pop(f, fps, b + 6 + i * 3, 420, 16);
            return <div key={i} style={{width: 30, height: 30, borderRadius: 15, background: C.red, transform: `scale(${d})`, boxShadow: '0 0 24px rgba(255,45,45,0.8)'}} />;
          })}
        </div>
      )}
      {source && <div style={{position: 'absolute', bottom: 440, right: 64, fontFamily: INTER, fontWeight: 600, fontSize: 22, letterSpacing: 2, color: C.muted, opacity: sIn}}>{source}</div>}
    </AbsoluteFill>
  );
};

export const counterCues = (p: CounterProps): Sfx[] => {
  const at = p.at ?? 0.15, cd = p.countDur ?? 0.9;
  const out: Sfx[] = [
    {src: 'sfx/counter-roll.mp3', at, volume: 0.35},
    {src: 'sfx/hit.mp3', at: at + cd - 0.02, volume: 0.6},
  ];
  for (let i = 0; i < (p.dots ?? 0); i++) out.push({src: 'sfx/tick.mp3', at: at + cd + (6 + i * 3) / 30, volume: 0.3});
  return out;
};
