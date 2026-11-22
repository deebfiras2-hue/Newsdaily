import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER, W} from '../theme';
import {clamp, pop, prog} from '../lib/anim';
import {Kicker} from '../components/Callout';
import {Sfx} from '../spec';

export type TimelineProps = {
  title?: string;
  kicker?: string;
  items: {date: string; label: string; at: number}[];
  spacing?: number;
  y?: number;
  dur: number;
};

export const Timeline: React.FC<TimelineProps> = ({title, kicker, items, spacing = 500, y = 860}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  // continuous "active position" that springs from item to item
  let pos = 0;
  items.forEach((it, i) => {
    if (i === 0) return;
    pos += pop(f, fps, it.at * fps - 2, 170, 22) * 1;
  });
  const shift = W / 2 - pos * spacing - 60;
  const active = items.reduce((a, it, i) => (t >= it.at ? i : a), -1);
  const lineP = prog(f, 0, 14);
  return (
    <AbsoluteFill style={{background: `radial-gradient(ellipse 120% 60% at 50% 45%, #17171E 0%, ${C.bg} 70%)`}}>
      <div style={{position: 'absolute', left: 64, right: 64, top: 360, opacity: prog(f, 0, 12)}}>
        {kicker && <Kicker text={kicker} />}
        {title && <div style={{fontFamily: ANTON, fontSize: 96, color: C.white, letterSpacing: 2, lineHeight: 1.05, marginTop: 8}}>{title}</div>}
      </div>
      <div style={{position: 'absolute', left: 0, top: y, width: W, height: 4, background: 'rgba(201,201,209,0.18)', transform: `scaleX(${lineP})`}} />
      <div style={{position: 'absolute', left: shift, top: y, width: (items.length - 1) * spacing, height: 0}}>
        {/* red progress line up to the moving head */}
        <div style={{position: 'absolute', left: 60, top: 0, height: 4, width: Math.max(0, pos * spacing), background: C.red}} />
        {items.map((it, i) => {
          const on = t >= it.at;
          const s = on ? pop(f, fps, it.at * fps, 380, 14) : 0;
          const isActive = i === active;
          const dist = Math.abs(i - pos);
          const sc = 1 - Math.min(0.5, dist * 0.42);
          const op = 1 - Math.min(0.75, dist * 0.42);
          return (
            <div key={i} style={{position: 'absolute', left: 60 + i * spacing, top: 0}}>
              <div style={{position: 'absolute', left: -18, top: -16, width: 36, height: 36, borderRadius: 18, background: on ? C.red : C.bg, border: `4px solid ${on ? C.red : 'rgba(201,201,209,0.5)'}`, transform: `scale(${0.8 + 0.4 * s})`, boxShadow: isActive ? '0 0 34px rgba(255,45,45,0.9)' : 'none', boxSizing: 'border-box'}} />
              {isActive && <div style={{position: 'absolute', left: -40, top: -38, width: 80, height: 80, borderRadius: 40, border: `3px solid ${C.red}`, opacity: 1 - clamp((f - it.at * fps) / 18), transform: `scale(${1 + clamp((f - it.at * fps) / 18)})`}} />}
              <div style={{position: 'absolute', left: -300, width: 600, bottom: 46, textAlign: 'center', fontFamily: ANTON, fontSize: 118, letterSpacing: 2, color: on ? C.white : 'rgba(201,201,209,0.45)', transform: `scale(${sc})`, transformOrigin: '50% 100%', opacity: op, whiteSpace: 'nowrap'}}>
                {it.date}
              </div>
              <div style={{position: 'absolute', left: -200, width: 400, top: 50, textAlign: 'center', fontFamily: INTER, fontWeight: 800, fontSize: 34, letterSpacing: 5, color: isActive ? C.red : C.gray, transform: `scale(${sc})`, transformOrigin: '50% 0%', opacity: op}}>
                {it.label}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

export const timelineCues = (p: TimelineProps): Sfx[] => p.items.map((it) => ({src: 'sfx/tick.mp3', at: it.at, volume: 0.45}));
