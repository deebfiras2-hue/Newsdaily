import React from 'react';
import {AbsoluteFill} from 'remotion';
import {TransitionKind} from '../spec';
import {clamp, ease, lerp} from '../lib/anim';
import {Brackets} from './Brackets';
import {C, W, H} from '../theme';

export const OVERLAP = 9;
export const FADE_OVERLAP = 12; // frames of overlap for animated transitions
export const overlaps = (k: TransitionKind | undefined) => !(k === 'cut' || k === 'flash');

/**
 * Wraps a scene layer. `inP` = progress of this scene's IN transition (0..1, 1 = done),
 * `outP` = progress of the NEXT scene's transition (0 = not started), `outKind` its kind.
 */
export const TransitionLayer: React.FC<{
  id: string;
  inKind: TransitionKind;
  inP: number;
  outKind?: TransitionKind;
  outP: number;
  children: React.ReactNode;
}> = ({id, inKind, inP, outKind, outP, children}) => {
  let tx = 0, ty = 0, sc = 1, op = 1, bx = 0, by = 0, blur = 0, bright = 1;
  let clip: string | undefined;
  let bracketRect: [number, number, number, number] | null = null;
  let flash = 0;
  const pi = ease.inOut(clamp(inP));
  const po = ease.inOut(clamp(outP));
  const vIn = Math.sin(Math.PI * clamp(inP));
  const vOut = Math.sin(Math.PI * clamp(outP));
  if (inP < 1) {
    switch (inKind) {
      case 'whip':
        tx += (1 - pi) * W * 1.05;
        bx += vIn * 70;
        break;
      case 'whipUp':
        ty += (1 - pi) * H * 1.02;
        by += vIn * 90;
        break;
      case 'zoom':
        sc *= lerp(0.5, 1, ease.out(clamp(inP)));
        op *= clamp(inP * 2.2);
        blur += (1 - clamp(inP)) * 18;
        break;
      case 'bracket': {
        const e = ease.out(clamp(inP));
        const iw = lerp(W * 0.32, W + 40, e), ih = lerp(W * 0.32, H + 40, e);
        const x = (W - iw) / 2, y = (H - ih) / 2;
        clip = `inset(${y}px ${x}px ${y}px ${x}px)`;
        bracketRect = [x, y, iw, ih];
        break;
      }
      case 'flash':
        flash = 1 - clamp(inP * 1.6);
        break;
      case 'fade':
        op *= ease.inOut(clamp(inP));
        sc *= lerp(1.03, 1, ease.out(clamp(inP)));
        break;
    }
  }
  if (outP > 0 && outKind) {
    switch (outKind) {
      case 'whip':
        tx -= po * W * 1.05;
        bx += vOut * 70;
        break;
      case 'whipUp':
        ty -= po * H * 1.02;
        by += vOut * 90;
        break;
      case 'zoom':
        sc *= lerp(1, 3.2, ease.in(clamp(outP)));
        op *= 1 - clamp(outP * 1.1);
        blur += clamp(outP) * 22;
        break;
      case 'bracket':
        sc *= 1 - 0.08 * po;
        bright *= 1 - 0.65 * po;
        break;
    }
  }
  const fid = `mb-${id}`;
  const filters: string[] = [];
  if (bx > 0.5 || by > 0.5) filters.push(`url(#${fid})`);
  if (blur > 0.3) filters.push(`blur(${blur}px)`);
  if (bright < 0.999) filters.push(`brightness(${bright})`);
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={`${bx} ${by}`} />
        </filter>
      </svg>
      <AbsoluteFill
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${sc})`,
          opacity: op,
          filter: filters.length ? filters.join(' ') : undefined,
          clipPath: clip,
          overflow: 'hidden',
          backgroundColor: C.bg,
        }}
      >
        {children}
      </AbsoluteFill>
      {bracketRect && inP < 1 && (
        <Brackets x={bracketRect[0]} y={bracketRect[1]} w={bracketRect[2]} h={bracketRect[3]} arm={120} stroke={12} opacity={1 - clamp((inP - 0.7) / 0.3)} />
      )}
      {flash > 0 && <AbsoluteFill style={{background: '#fff', opacity: flash * 0.85}} />}
    </AbsoluteFill>
  );
};
