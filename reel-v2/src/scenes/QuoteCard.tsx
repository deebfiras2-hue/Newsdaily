import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER, W} from '../theme';
import {clamp, ease, pop, prog} from '../lib/anim';
import {resolveSrc, useTexture} from '../lib/texture';
import {Planet} from '../components/Planet';
import {Brackets} from '../components/Brackets';
import {Kicker} from '../components/Callout';
import {Sfx} from '../spec';

export type QuoteProps = {
  text: string; // use \n for line breaks
  red?: string[];
  kicker?: string;
  attribution?: string;
  size?: number;
  y?: number;
  bg?: {image?: string; planet?: string; lon?: number};
  brackets?: boolean;
  impact?: boolean;
  dur: number;
};

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\-]/g, '');

export const QuoteCard: React.FC<QuoteProps> = ({text, red = [], kicker, attribution, size = 150, y = 560, bg, brackets = true}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const tex = useTexture(bg?.planet ? (bg.planet === 'mercury' ? 'global/mercury_md3.jpg' : bg.planet === 'earth' ? 'global/earth_bluemarble.jpg' : bg.planet) : undefined);
  const redSet = new Set(red.map(clean));
  const lines = text.split('\n');
  let wi = 0;
  const lh = size * 1.04;
  const boxH = lines.length * lh + (attribution ? 90 : 0);
  const bp = pop(f, fps, 2, 300, 20);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {bg?.image && (
        <AbsoluteFill style={{transform: `scale(${1.1 + t * 0.03})`, filter: 'brightness(0.3) blur(4px)'}}>
          <Img src={resolveSrc(bg.image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </AbsoluteFill>
      )}
      {bg?.planet && (
        <AbsoluteFill style={{opacity: 0.9}}>
          <Planet tex={tex} cx={W / 2 + 120} cy={1500} r={760 + t * 14} look={{lon: (bg.lon ?? 0) + t * 4, lat: 10, light: [0.7, 0.5, 0.5], ambient: 0.02, tint: [1.08, 1.0, 0.9], contrast: 1.15}} />
          <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,0.92) 30%, rgba(11,11,15,0.35) 70%, rgba(11,11,15,0.6) 100%)'}} />
        </AbsoluteFill>
      )}
      {kicker && (
        <div style={{position: 'absolute', left: 90, top: y - 70, opacity: prog(f, 0, 10)}}>
          <Kicker text={kicker} />
        </div>
      )}
      {brackets && <Brackets x={56 - (1 - bp) * 60} y={y - 110 - (1 - bp) * 60} w={W - 112 + (1 - bp) * 120} h={boxH + 170 + (1 - bp) * 120} arm={70} stroke={10} opacity={clamp(bp * 1.5)} />}
      <div style={{position: 'absolute', left: 90, right: 90, top: y}}>
        {lines.map((ln, li) => (
          <div key={li} style={{fontFamily: ANTON, fontSize: size, lineHeight: `${lh}px`, letterSpacing: 2, color: C.white, whiteSpace: 'nowrap'}}>
            {ln.split(' ').map((w, j) => {
              const k = wi++;
              const s = pop(f, fps, 3 + k * 2.2, 340, 20);
              return (
                <span key={j} style={{display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', marginRight: size * 0.22}}>
                  <span style={{display: 'inline-block', transform: `translateY(${(1 - s) * 110}%)`, color: redSet.has(clean(w)) ? C.red : C.white}}>{w}</span>
                </span>
              );
            })}
          </div>
        ))}
        {attribution && (
          <div style={{marginTop: 30, fontFamily: INTER, fontWeight: 700, fontSize: 32, letterSpacing: 5, color: C.gray, opacity: prog(f, 3 + wi * 2.2, 3 + wi * 2.2 + 10, ease.out)}}>{attribution}</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

export const quoteCues = (p: QuoteProps): Sfx[] => (p.impact ? [{src: 'sfx/impact-boom.mp3', at: 0.0, volume: 0.55}] : [{src: 'sfx/snap.mp3', at: 0.05, volume: 0.4}]);
