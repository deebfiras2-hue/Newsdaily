import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER} from '../theme';
import {pop, prog} from '../lib/anim';

/** Red pin with pulse rings + leader line + label (used on globes, maps, solar system). */
export const Pin: React.FC<{x: number; y: number; at?: number; label?: string; sub?: string; side?: 'left' | 'right'; lineLen?: number; size?: number}> = ({
  x,
  y,
  at = 0,
  label,
  sub,
  side = 'right',
  lineLen = 120,
  size = 1,
}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = pop(f, fps, at);
  if (f < at) return null;
  const pulses = [0, 14, 28].map((d) => ((f - at - d) % 42 + 42) % 42 / 42);
  const ln = prog(f, at + 4, at + 14);
  const dir = side === 'right' ? 1 : -1;
  const lx = x + dir * 26 * size, ly = y - 26 * size;
  const ex = lx + dir * lineLen * ln;
  const tp = prog(f, at + 10, at + 22);
  return (
    <>
      <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible'}} width={1} height={1}>
        {pulses.map((p, i) => (
          <circle key={i} cx={x} cy={y} r={(10 + p * 46) * size} fill="none" stroke={C.red} strokeWidth={3} opacity={(1 - p) * 0.8 * s} />
        ))}
        <circle cx={x} cy={y} r={11 * size * s} fill={C.red} />
        <circle cx={x} cy={y} r={4.5 * size * s} fill={C.white} />
        {label && <polyline points={`${x + dir * 8},${y - 8} ${lx},${ly} ${ex},${ly}`} fill="none" stroke={C.white} strokeWidth={3} opacity={ln} />}
      </svg>
      {label && (
        <div
          style={{
            position: 'absolute',
            top: ly - 74 * size,
            ...(side === 'right' ? {left: lx + 4} : {right: 1080 - lx + 4}),
            textAlign: side === 'right' ? 'left' : 'right',
            opacity: tp,
            transform: `translateY(${(1 - tp) * 16}px)`,
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{fontFamily: ANTON, fontSize: 60 * size, color: C.white, letterSpacing: 2, lineHeight: 1.1}}>{label}</div>
          {sub && (
            <div style={{fontFamily: INTER, fontWeight: 700, fontSize: 26 * size, color: C.gray, letterSpacing: 3, marginTop: 24 * size}}>{sub}</div>
          )}
        </div>
      )}
    </>
  );
};

/** small bracket tag: [ TEXT ] kicker in red */
export const Kicker: React.FC<{text: string; color?: string; size?: number}> = ({text, color = C.red, size = 30}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 14,
      fontFamily: INTER,
      fontWeight: 800,
      fontSize: size,
      letterSpacing: size * 0.18,
      color,
      textTransform: 'uppercase',
    }}
  >
    <span style={{width: 28, height: 4, background: color, display: 'inline-block'}} />
    {text}
  </div>
);
