import React, {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {C, INTER, W, H} from '../theme';
import {clamp, ease, lerp, prog, smooth} from '../lib/anim';
import {useImage} from '../lib/image';
import {resolveSrc, useTexture} from '../lib/texture';
import {Starfield} from '../components/Starfield';
import {Pin} from '../components/Callout';
import {Planet, project} from '../components/Planet';
import {Sfx} from '../spec';

type Body = {name: string; r: number; angle: number; size: number; color: string; label?: string};
export type ZoomOutProps = {
  mode?: 'space' | 'earth';
  image: string;
  imageSize: [number, number];
  /** planet disc inside the photo (space mode), in image px: [cx, cy, r] */
  disc?: [number, number, number];
  /** where the shot starts (normalised image coords) */
  focus?: [number, number];
  detailEnd?: number;
  revealStart?: number;
  revealEnd?: number;
  /** space mode */
  target?: string; // name of body that the photo represents
  bodies?: Body[];
  tilt?: number;
  pin?: {label: string; sub?: string; at?: number; side?: 'left' | 'right'};
  /** px to push the planet down during the hold (room for the title) */
  lift?: number;
  /** earth mode */
  lon?: number;
  lat?: number;
  dur: number;
};

const DEFAULT_BODIES: Body[] = [
  {name: 'mercury', r: 200, angle: 160, size: 10, color: '#b9b4ad', label: 'MERCURY'},
  {name: 'venus', r: 345, angle: 300, size: 14, color: '#e6cf9b', label: 'VENUS'},
  {name: 'earth', r: 480, angle: 120, size: 14, color: '#5b93e0', label: 'EARTH'},
];

export const ZoomOutOpener: React.FC<ZoomOutProps> = (p) => (p.mode === 'earth' ? <EarthOpener {...p} /> : <SpaceOpener {...p} />);

const SpaceOpener: React.FC<ZoomOutProps> = ({image, imageSize, disc, focus = [0.4, 0.4], detailEnd = 1.6, revealStart = 2.1, revealEnd = 3.9, target = 'mercury', bodies = DEFAULT_BODIES, tilt = 0.4, pin, lift = 0}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const img = useImage(image);
  const sun = useImage('global/sun_sdo304.jpg');
  const ref = useRef<HTMLCanvasElement>(null);
  const [iw, ih] = imageSize;
  const [dcx, dcy, dr] = disc ?? [iw / 2, ih / 2, Math.min(iw, ih) / 2];
  const tb = bodies.find((b) => b.name === target) ?? bodies[0];
  const rad = (a: number) => (a * Math.PI) / 180;
  const pos = (b: Body, extra = 0): [number, number] => [b.r * Math.cos(rad(b.angle + extra)), b.r * Math.sin(rad(b.angle + extra)) * tilt];
  const drift = t * 1.2; // slow orbital drift (deg)
  const M = pos(tb, drift);
  const unit = tb.size / dr; // world units per image px
  // zoom curve (screen px per world unit)
  const z0 = (W * 5.5) / 2 / tb.size, zMid = 470 / tb.size, z1 = 1.5;
  let lz: number;
  if (t < detailEnd) lz = lerp(Math.log(z0), Math.log(zMid), ease.out(clamp(t / detailEnd)));
  else if (t < revealStart) lz = lerp(Math.log(zMid), Math.log(zMid * 0.86), (t - detailEnd) / (revealStart - detailEnd));
  else lz = lerp(Math.log(zMid * 0.86), Math.log(z1), ease.inOut(clamp((t - revealStart) / (revealEnd - revealStart))));
  const z = Math.exp(lz) * (1 + 0.04 * clamp((t - revealEnd) / 2)); // tiny push after settle
  const u = smooth((Math.log(zMid * 0.86) - Math.log(z)) / Math.log(zMid * 0.86)); // 0 planet .. 1 system
  const fo = 1 - ease.out(clamp(t / detailEnd));
  const off = [(focus[0] * iw - dcx) * unit * fo, (focus[1] * ih - dcy) * unit * fo];
  const final = [-70, 10];
  // while the hook title is up, hold the planet low in frame (title above, planet below)
  const low = (lift / z) * (1 - u) * ease.out(clamp(t / detailEnd));
  const cam = [lerp(M[0] + off[0], final[0], u), lerp(M[1] + off[1], final[1], u) - low];
  const S = (x: number, y: number): [number, number] => [W / 2 + (x - cam[0]) * z, H / 2 + (y - cam[1]) * z];

  useLayoutEffect(() => {
    const g = ref.current!.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    // sun glow + disc
    const [sx, sy] = S(0, 0);
    const sr = 34 * z;
    const glow = g.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 9);
    glow.addColorStop(0, 'rgba(255,170,80,0.55)');
    glow.addColorStop(0.25, 'rgba(255,110,40,0.16)');
    glow.addColorStop(1, 'rgba(255,80,30,0)');
    g.globalAlpha = clamp(u * 1.4);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);
    if (sun && sr > 0.5) {
      g.save();
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.clip();
      g.drawImage(sun, sx - sr * 1.08, sy - sr * 1.08, sr * 2.16, sr * 2.16);
      g.restore();
    }
    g.globalAlpha = 1;
    // orbits
    const oa = clamp((u - 0.25) / 0.5);
    if (oa > 0) {
      bodies.forEach((b) => {
        g.beginPath();
        g.ellipse(sx, sy, b.r * z, b.r * tilt * z, 0, 0, Math.PI * 2);
        g.strokeStyle = b.name === target ? `rgba(255,45,45,${0.85 * oa})` : `rgba(201,201,209,${0.32 * oa})`;
        g.lineWidth = b.name === target ? 3 : 2;
        g.setLineDash(b.name === target ? [] : [2, 8]);
        g.stroke();
      });
      g.setLineDash([]);
    }
    // other planets (small shaded discs)
    bodies.forEach((b) => {
      if (b.name === target) return;
      const [bx, by] = S(...pos(b, drift * (200 / b.r)));
      const br = Math.max(b.size * z, 0);
      if (br < 0.5) return;
      const gr = g.createRadialGradient(bx + br * 0.35, by - br * 0.3, br * 0.1, bx, by, br);
      gr.addColorStop(0, b.color);
      gr.addColorStop(1, 'rgba(10,10,14,1)');
      g.globalAlpha = oa;
      g.fillStyle = gr;
      g.beginPath();
      g.arc(bx, by, br, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    });
    // the hero planet = the actual photo, placed so its disc sits on the orbit
    if (img) {
      const [mx, my] = S(M[0], M[1]);
      const k = unit * z; // screen px per image px
      g.save();
      
      g.drawImage(img, mx - dcx * k, my - dcy * k, iw * k, ih * k);
      g.restore();
    }
  });

  const labels = clamp((u - 0.85) / 0.15);
  const [mx, my] = S(M[0], M[1]);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Starfield zoom={1 + (1 - u) * 6} drift={t} opacity={0.35 + 0.65 * u} />
      <canvas ref={ref} width={W} height={H} style={{position: 'absolute', inset: 0}} />
      {labels > 0 &&
        bodies
          .filter((b) => b.name !== target && b.label)
          .map((b) => {
            const [bx, by] = S(...pos(b, drift * (200 / b.r)));
            return (
              <div key={b.name} style={{position: 'absolute', left: bx - 150, width: 300, top: by + b.size * z + 12, textAlign: 'center', fontFamily: INTER, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: C.gray, opacity: labels}}>
                {b.label}
              </div>
            );
          })}
      {labels > 0 && (
        <div style={{position: 'absolute', left: S(0, 0)[0] - 150, width: 300, top: S(0, 0)[1] + 34 * z + 14, textAlign: 'center', fontFamily: INTER, fontWeight: 700, fontSize: 24, letterSpacing: 5, color: '#ffb27a', opacity: labels}}>
          SUN
        </div>
      )}
      {pin && <Pin x={mx} y={my} at={Math.round((pin.at ?? revealEnd - 0.1) * fps)} label={pin.label} sub={pin.sub} side={pin.side ?? 'left'} lineLen={60} size={0.85} />}
    </AbsoluteFill>
  );
};

/** Earth stories: tight photo detail -> full photo -> photo collapses into a pin on a rotating Blue Marble globe. */
const EarthOpener: React.FC<ZoomOutProps> = ({image, focus = [0.5, 0.45], detailEnd = 1.4, revealStart = 1.9, revealEnd = 3.4, lon = 0, lat = 20, pin}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const tex = useTexture('global/earth_bluemarble.jpg');
  const photoZoom = lerp(3.4, 1.05, ease.out(clamp(t / detailEnd)));
  const r = prog(t, revealStart, revealEnd, ease.inOut);
  const R = lerp(2600, 400, r);
  const look = {lon: lon - lerp(70, 0, ease.out(clamp((t - revealStart) / (revealEnd - revealStart + 0.8)))), lat: lat * 0.6};
  const cy = 880;
  const pp = project(lon, lat, look, W / 2, cy, R);
  const card = r; // photo shrinks into the pin
  const cs = lerp(1, 0.0, ease.in(card));
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Starfield zoom={1 + (1 - r) * 3} drift={t} opacity={r} />
      <Planet tex={tex} cx={W / 2} cy={cy} r={R} look={{...look, atmosphere: [90, 160, 255], light: [-0.6, 0.35, 0.72], ambient: 0.08}} style={{opacity: clamp(r * 3)}} />
      {cs > 0.01 && (
        <AbsoluteFill
          style={{
            transform: `translate(${(pp.x - W / 2) * card}px, ${(pp.y - H / 2) * card}px) scale(${cs})`,
            borderRadius: 40 * card,
            overflow: 'hidden',
            boxShadow: card > 0 ? '0 30px 80px rgba(0,0,0,0.6)' : undefined,
          }}
        >
          <img
            src={resolveSrc(image)}
            style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${focus[0] * 100}% ${focus[1] * 100}%`, transform: `scale(${photoZoom})`, transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`}}
          />
        </AbsoluteFill>
      )}
      {pin && pp.z > 0 && <Pin x={pp.x} y={pp.y} at={Math.round((pin.at ?? revealEnd) * fps)} label={pin.label} sub={pin.sub} side={pin.side ?? 'right'} />}
    </AbsoluteFill>
  );
};

export const zoomOutCues = (p: ZoomOutProps): Sfx[] => [
  {src: 'sfx/riser-short.mp3', at: Math.max(0, (p.revealStart ?? 2.1) - 1.0), volume: 0.35},
  {src: 'sfx/whoosh-deep.mp3', at: (p.revealStart ?? 2.1) + 0.2, volume: 0.6},
  {src: 'sfx/pop.mp3', at: (p.pin?.at ?? (p.revealEnd ?? 3.9) - 0.1), volume: 0.5},
];
