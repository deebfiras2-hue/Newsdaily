import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, INTER} from '../theme';
import {clamp, ease, pop, prog} from '../lib/anim';
import {resolveSrc} from '../lib/texture';
import {Kicker} from '../components/Callout';
import {Sfx} from '../spec';

export type PhotoProps = {
  src: string;
  fg?: string; // RGBA cut-out of the subject (tools/cutout.py) for 2.5D parallax
  focus?: [number, number]; // object-position (0..1)
  title?: string;
  kicker?: string;
  credit?: string;
  push?: number;
  dir?: 1 | -1;
  titleY?: number;
  red?: string[];
  dur: number;
};

export const PhotoCard: React.FC<PhotoProps> = ({src, fg, focus = [0.5, 0.5], title, kicker, credit, push = 0.12, dir = 1, titleY = 1010, red = [], dur}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = clamp(f / (dur * fps + 9));
  const e = ease.inOut(t) * 0.35 + t * 0.65;
  const pos = `${focus[0] * 100}% ${focus[1] * 100}%`;
  const bgS = 1.1 + push * e;
  const fgS = 1.1 + push * 1.9 * e;
  const imgStyle: React.CSSProperties = {position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: pos};
  const sweep = prog(f, 6, 6 + 34, ease.inOut);
  const tIn = pop(f, fps, 5, 220, 20);
  const kIn = prog(f, 2, 12);
  const words = (title ?? '').split(' ');
  const redSet = new Set(red.map((r) => r.toLowerCase()));
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <AbsoluteFill style={{transform: `scale(${bgS}) translateX(${-dir * 18 * e}px)`, transformOrigin: pos, filter: fg ? 'brightness(0.62) saturate(0.9) blur(3px)' : 'brightness(0.92)'}}>
        <Img src={resolveSrc(src)} style={imgStyle} />
      </AbsoluteFill>
      {fg && (
        <AbsoluteFill style={{transform: `scale(${fgS}) translateX(${dir * 14 * e}px)`, transformOrigin: pos, filter: 'drop-shadow(0 30px 40px rgba(0,0,0,0.55))'}}>
          <Img src={resolveSrc(fg)} style={imgStyle} />
          {/* light sweep, masked to the subject */}
          <AbsoluteFill
            style={{
              WebkitMaskImage: `url(${resolveSrc(fg)})`,
              WebkitMaskSize: 'cover',
              WebkitMaskPosition: pos,
              WebkitMaskRepeat: 'no-repeat',
              background: `linear-gradient(105deg, rgba(255,255,255,0) ${sweep * 160 - 40}%, rgba(255,255,255,0.38) ${sweep * 160 - 25}%, rgba(255,255,255,0) ${sweep * 160 - 10}%)`,
              mixBlendMode: 'screen',
            }}
          />
        </AbsoluteFill>
      )}
      {!fg && (
        <AbsoluteFill
          style={{
            background: `linear-gradient(105deg, rgba(255,255,255,0) ${sweep * 160 - 40}%, rgba(255,255,255,0.16) ${sweep * 160 - 25}%, rgba(255,255,255,0) ${sweep * 160 - 10}%)`,
            mixBlendMode: 'screen',
          }}
        />
      )}
      {/* legibility gradient for title + captions */}
      <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(11,11,15,0.55) 0%, rgba(11,11,15,0) 22%, rgba(11,11,15,0) 38%, rgba(11,11,15,0.9) 62%, rgba(11,11,15,0.95) 100%)'}} />
      {credit && (
        <div style={{position: 'absolute', right: 64, top: 322, fontFamily: INTER, fontWeight: 600, fontSize: 20, letterSpacing: 1.5, color: 'rgba(201,201,209,0.8)', opacity: kIn}}>
          {credit}
        </div>
      )}
      <div style={{position: 'absolute', left: 64, right: 64, top: titleY}}>
        {kicker && (
          <div style={{opacity: kIn, transform: `translateX(${(1 - kIn) * -30}px)`, marginBottom: 6}}>
            <Kicker text={kicker} color={C.white} />
          </div>
        )}
        {title && (
          <div style={{overflow: 'hidden', paddingTop: 6}}>
            <div style={{fontFamily: ANTON, fontSize: 138, lineHeight: 1.0, letterSpacing: 2, color: C.white, transform: `translateY(${(1 - tIn) * 150}px)`, textShadow: '0 8px 30px rgba(0,0,0,0.6)'}}>
              {words.map((w, i) => (
                <span key={i} style={{color: redSet.has(w.toLowerCase()) ? C.red : C.white}}>
                  {w}
                  {i < words.length - 1 ? ' ' : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {title && <div style={{height: 8, background: C.red, marginTop: 14, width: `${prog(f, 10, 24) * 220}px`}} />}
      </div>
    </AbsoluteFill>
  );
};

export const photoCues = (): Sfx[] => [{src: 'sfx/tick.mp3', at: 0.2, volume: 0.35}];
