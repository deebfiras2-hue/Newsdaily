import React from 'react';
import {C} from '../theme';

/** Viewfinder brackets (brand mark): 4 red L corners around a rect. */
export const Brackets: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  arm?: number;
  stroke?: number;
  color?: string;
  dot?: number; // radius of the centre dot (0 = none)
  opacity?: number;
}> = ({x, y, w, h, arm, stroke = 10, color = C.red, dot = 0, opacity = 1}) => {
  const a = arm ?? Math.min(w, h) * 0.28;
  const s = stroke;
  const corners = [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x, y + h, 1, -1],
    [x + w, y + h, -1, -1],
  ];
  return (
    <svg style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity}} width={1} height={1}>
      {corners.map(([cx, cy, sx, sy], i) => (
        <path
          key={i}
          d={`M ${cx + sx * a} ${cy + (sy * s) / 2} L ${cx + (sx * s) / 2} ${cy + (sy * s) / 2} L ${cx + (sx * s) / 2} ${cy + sy * a}`}
          stroke={color}
          strokeWidth={s}
          fill="none"
          strokeLinecap="butt"
          strokeLinejoin="miter"
        />
      ))}
      {dot > 0 && <circle cx={x + w / 2} cy={y + h / 2} r={dot} fill={C.white} />}
    </svg>
  );
};

/** Brand logo: viewfinder icon (brackets + white dot) in a square of size S. */
export const Logo: React.FC<{x: number; y: number; S: number; dot?: boolean}> = ({x, y, S, dot = true}) => (
  <Brackets x={x} y={y} w={S} h={S} arm={0.31 * S} stroke={Math.max(2, 0.08 * S)} dot={dot ? 0.12 * S : 0} />
);
