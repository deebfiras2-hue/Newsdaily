import React from 'react';
import {AbsoluteFill, Img, useCurrentFrame, useVideoConfig} from 'remotion';
import {ANTON, C, W} from '../theme';
import {clamp, ease, lerp, prog} from '../lib/anim';
import {resolveSrc, useTexture} from '../lib/texture';
import {Planet, project} from '../components/Planet';
import {Starfield} from '../components/Starfield';
import {Kicker, Pin} from '../components/Callout';
import {Sfx} from '../spec';

const TEX: Record<string, string> = {earth: 'global/earth_bluemarble.jpg', mercury: 'global/mercury_md3.jpg'};

export type GlobeProps = {
  texture?: string; // 'earth' | 'mercury' | path to an equirectangular map
  lon?: number;
  lat?: number;
  fromLon?: number; // start rotation offset (deg) -> spins to target
  spin?: number; // extra deg/s after arriving
  radius?: number;
  cy?: number;
  zoomFrom?: number; // radius multiplier at start
  pin?: {lon: number; lat: number; label: string; sub?: string; at?: number; side?: 'left' | 'right'};
  orbit?: {rx: number; ry: number; tilt?: number; period?: number; sat?: string; satSize?: number; label?: string};
  title?: string;
  kicker?: string;
  tint?: [number, number, number];
  light?: [number, number, number];
  dur: number;
};

export const Globe: React.FC<GlobeProps> = ({texture = 'earth', lon = 0, lat = 15, fromLon = 80, spin = 2, radius = 420, cy = 880, zoomFrom = 1.25, pin, orbit, title, kicker, tint, light}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const tex = useTexture(TEX[texture] ?? texture);
  const arrive = ease.out(clamp(t / 1.3));
  const look = {lon: lon - fromLon * (1 - arrive) + spin * t, lat: lat * 0.75};
  const R = radius * lerp(zoomFrom, 1, ease.out(clamp(t / 1.1)));
  const isEarth = texture === 'earth';
  const pp = pin ? project(pin.lon, pin.lat, look, W / 2, cy, R) : null;
  // orbit ring split in back/front halves around the planet
  const rot = orbit?.tilt ?? -14;
  const per = orbit?.period ?? 3.2;
  const ang = (t / per) * Math.PI * 2 + 0.8;
  const ox = orbit ? Math.cos(ang) * orbit.rx * (R / radius) : 0;
  const oy = orbit ? Math.sin(ang) * orbit.ry * (R / radius) : 0;
  const rr = (rot * Math.PI) / 180;
  const sx = W / 2 + ox * Math.cos(rr) - oy * Math.sin(rr);
  const sy = cy + ox * Math.sin(rr) + oy * Math.cos(rr);
  const front = Math.sin(ang) > 0;
  const ringP = prog(f, 6, 26, ease.out);
  const ring = (half: 'back' | 'front') =>
    orbit && (
      <svg width={W} height={1920} style={{position: 'absolute', inset: 0}}>
        <g transform={`rotate(${rot} ${W / 2} ${cy})`}>
          <path
            d={`M ${W / 2 - orbit.rx * (R / radius)} ${cy} A ${orbit.rx * (R / radius)} ${orbit.ry * (R / radius)} 0 0 ${half === 'front' ? 0 : 1} ${W / 2 + orbit.rx * (R / radius)} ${cy}`}
            fill="none"
            stroke={C.red}
            strokeWidth={half === 'front' ? 5 : 3}
            opacity={(half === 'front' ? 0.95 : 0.45) * ringP}
            strokeDasharray={half === 'back' ? '10 12' : undefined}
          />
        </g>
      </svg>
    );
  const sat = orbit?.sat && (
    <div style={{position: 'absolute', left: sx - (orbit.satSize ?? 120) / 2, top: sy - (orbit.satSize ?? 120) / 2, width: orbit.satSize ?? 120, height: orbit.satSize ?? 120, opacity: ringP, filter: 'drop-shadow(0 0 18px rgba(255,255,255,0.35))'}}>
      <Img src={resolveSrc(orbit.sat)} style={{width: '100%', height: '100%', objectFit: 'contain', transform: `rotate(${(ang * 180) / Math.PI + 90}deg) scale(${front ? 1 : 0.8})`}} />
    </div>
  );
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Starfield drift={t} opacity={0.8} seed={texture.length} />
      {ring('back')}
      {orbit && !front && sat}
      <Planet
        tex={tex}
        cx={W / 2}
        cy={cy}
        r={R}
        look={{...look, atmosphere: isEarth ? [95, 165, 255] : null, tint: tint ?? (isEarth ? [1, 1, 1] : [1.08, 1.0, 0.9]), light: light ?? [0.62, 0.32, 0.72], ambient: isEarth ? 0.05 : 0.03, contrast: isEarth ? 1.08 : 1.15}}
      />
      {ring('front')}
      {orbit && front && sat}
      {pp && pp.z > 0.05 && pin && <Pin x={pp.x} y={pp.y} at={Math.round((pin.at ?? 1.1) * fps)} label={pin.label} sub={pin.sub} side={pin.side} />}
      {(title || kicker) && (
        <div style={{position: 'absolute', left: 64, right: 64, top: 360, opacity: prog(f, 0, 12)}}>
          {kicker && <Kicker text={kicker} />}
          {title && <div style={{fontFamily: ANTON, fontSize: 96, color: C.white, letterSpacing: 2, lineHeight: 1.05, marginTop: 8}}>{title}</div>}
        </div>
      )}
    </AbsoluteFill>
  );
};

export const globeCues = (p: GlobeProps): Sfx[] => (p.pin ? [{src: 'sfx/pop.mp3', at: p.pin.at ?? 1.1, volume: 0.5}] : []);
