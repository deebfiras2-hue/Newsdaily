import React, {useLayoutEffect, useMemo, useRef} from 'react';
import {W, H} from '../theme';
import {rand} from '../lib/anim';

/** Deterministic star field; `zoom` scales positions around the centre (parallax by depth). */
export const Starfield: React.FC<{zoom?: number; drift?: number; opacity?: number; seed?: number; count?: number}> = ({
  zoom = 1,
  drift = 0,
  opacity = 1,
  seed = 3,
  count = 700,
}) => {
  const stars = useMemo(
    () =>
      new Array(count).fill(0).map((_, i) => ({
        x: rand(seed * 1000 + i) * 2 - 1,
        y: rand(seed * 2000 + i) * 2 - 1,
        d: 0.25 + rand(seed * 3000 + i) * 0.75,
        b: Math.pow(rand(seed * 4000 + i), 3),
        tw: rand(seed * 5000 + i) * 6.28,
      })),
    [seed, count],
  );
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const g = ref.current!.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    for (const s of stars) {
      const z = Math.pow(zoom, s.d * 0.35);
      const x = W / 2 + (s.x * W * 0.9 + drift * s.d * 40) * z;
      const y = H / 2 + s.y * H * 0.62 * z;
      if (x < -4 || x > W + 4 || y < -4 || y > H + 4) continue;
      const a = (0.25 + 0.75 * s.b) * (0.8 + 0.2 * Math.sin(s.tw + drift * 2));
      const r = 0.6 + s.b * 1.6;
      g.fillStyle = `rgba(${220 + s.b * 35},${225 + s.b * 30},255,${a})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0, opacity}} />;
};
