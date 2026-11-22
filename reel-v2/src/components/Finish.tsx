import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {rand} from '../lib/anim';

/** Film finish: animated grain + vignette + faint top/bottom shade for legibility. */
export const Finish: React.FC<{grain?: number}> = ({grain = 0.085}) => {
  const f = useCurrentFrame();
  const ox = Math.floor(rand(f + 1) * 512), oy = Math.floor(rand(f + 99) * 512);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          background: 'radial-gradient(ellipse 85% 70% at 50% 46%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile('global/grain.png')})`,
          backgroundPosition: `${ox}px ${oy}px`,
          backgroundSize: '512px 512px',
          mixBlendMode: 'overlay',
          opacity: grain,
        }}
      />
    </AbsoluteFill>
  );
};
