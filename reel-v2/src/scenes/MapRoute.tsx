import React, {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {geoMercator, geoPath, geoInterpolate, GeoPermissibleObjects} from 'd3-geo';
import {feature} from 'topojson-client';
import {ANTON, C, INTER, W} from '../theme';
import {clamp, ease, pop, prog, smooth} from '../lib/anim';
import {Starfield} from '../components/Starfield';
import {Kicker} from '../components/Callout';
import {Pin} from '../components/Callout';
import {Sfx} from '../spec';

type Orbit = {name: string; r: number; color: string; angle?: number; label?: string; size?: number};
type WP = {a: number; r: number; label?: string; flyby?: boolean};
export type RouteProps = {
  mode?: 'space' | 'earth';
  title?: string;
  kicker?: string;
  // space mode
  orbits?: Orbit[];
  waypoints?: WP[];
  tilt?: number;
  drawStart?: number;
  drawDur?: number;
  counterLabel?: string;
  // earth mode
  route?: [number, number][]; // [lon, lat] points
  highlight?: string[]; // country names (world-atlas properties.name)
  labels?: {lon: number; lat: number; text: string; sub?: string; side?: 'left' | 'right'}[];
  dur: number;
};

const D2R = Math.PI / 180;
const CX = W / 2, CY = 860;

/** r(θ) through keyframes with smoothstep easing between them */
const radiusAt = (wps: WP[], a: number) => {
  if (a <= wps[0].a) return wps[0].r;
  for (let i = 0; i < wps.length - 1; i++) {
    const A = wps[i], B = wps[i + 1];
    if (a <= B.a) return A.r + (B.r - A.r) * smooth((a - A.a) / (B.a - A.a));
  }
  return wps[wps.length - 1].r;
};

const SpaceRoute: React.FC<RouteProps> = ({title, kicker, orbits = [], waypoints = [], tilt = 0.55, drawStart = 0.2, drawDur = 2.2, counterLabel = 'FLYBYS'}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = f / fps;
  const rot = -12 * (t / 3); // slow camera yaw
  const zoom = 1.0 + 0.05 * (t / 3);
  const P = (r: number, a: number) => [CX + r * Math.cos((a + rot) * D2R) * zoom, CY + r * Math.sin((a + rot) * D2R) * tilt * zoom] as const;
  const a0 = waypoints[0]?.a ?? 0, aN = waypoints[waypoints.length - 1]?.a ?? 0;
  const head = a0 + (aN - a0) * clamp((t - drawStart) / drawDur);
  const pts = useMemo(() => {
    const out: [number, number][] = [];
    for (let a = a0; a <= aN; a += 2) out.push([a, radiusAt(waypoints, a)]);
    return out;
  }, [waypoints, a0, aN]);
  const drawn = pts.filter(([a]) => a <= head);
  const d = drawn.map(([a, r], i) => `${i ? 'L' : 'M'} ${P(r, a)[0].toFixed(1)} ${P(r, a)[1].toFixed(1)}`).join(' ');
  const hr = radiusAt(waypoints, head);
  const [hx, hy] = P(hr, head);
  const flybys = waypoints.filter((w) => w.flyby);
  const passed = flybys.filter((w) => w.a <= head).length;
  const tIn = prog(f, 0, 12);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <Starfield drift={t} opacity={0.6} seed={9} />
      <svg width={W} height={1920} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="sunG">
            <stop offset="0%" stopColor="#fff3d6" />
            <stop offset="30%" stopColor="#ffb05a" />
            <stop offset="100%" stopColor="rgba(255,120,40,0)" />
          </radialGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>
        <circle cx={CX} cy={CY} r={130} fill="url(#sunG)" opacity={0.55} />
        <circle cx={CX} cy={CY} r={26} fill="#ffd9a0" />
        {orbits.map((o) => (
          <ellipse key={o.name} cx={CX} cy={CY} rx={o.r * zoom} ry={o.r * tilt * zoom} fill="none" stroke="rgba(201,201,209,0.28)" strokeWidth={2} strokeDasharray="3 9" />
        ))}
        {orbits.map((o) => {
          const [x, y] = P(o.r, o.angle ?? 0);
          return (
            <g key={o.name + 'p'}>
              <circle cx={x} cy={y} r={o.size ?? 13} fill={o.color} />
              {o.label && (
                <text x={x} y={y + (o.size ?? 13) + 34} textAnchor="middle" fontFamily={INTER} fontWeight={700} fontSize={24} letterSpacing={5} fill={C.gray}>
                  {o.label}
                </text>
              )}
            </g>
          );
        })}
        <path d={d} fill="none" stroke={C.red} strokeWidth={10} opacity={0.35} filter="url(#glow)" />
        <path d={d} fill="none" stroke={C.red} strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round" />
        {flybys.map((w, i) => {
          if (w.a > head) return null;
          const wf = (drawStart + ((w.a - a0) / (aN - a0)) * drawDur) * fps;
          const s = pop(f, fps, wf, 420, 15);
          const [x, y] = P(w.r, w.a);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={16 * s} fill={C.bg} stroke={C.white} strokeWidth={4} />
              <circle cx={x} cy={y} r={30 * clamp((f - wf) / 12)} fill="none" stroke={C.white} strokeWidth={2} opacity={1 - clamp((f - wf) / 12)} />
            </g>
          );
        })}
        {head > a0 && (
          <g>
            <circle cx={hx} cy={hy} r={22} fill={C.red} opacity={0.35} filter="url(#glow)" />
            <circle cx={hx} cy={hy} r={10} fill={C.white} />
          </g>
        )}
      </svg>
      <div style={{position: 'absolute', left: 64, right: 64, top: 360, opacity: tIn}}>
        {kicker && <Kicker text={kicker} />}
        {title && <div style={{fontFamily: ANTON, fontSize: 96, color: C.white, letterSpacing: 2, lineHeight: 1.05, marginTop: 8}}>{title}</div>}
      </div>
      {flybys.length > 0 && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 1110, textAlign: 'center', opacity: prog(f, drawStart * fps, drawStart * fps + 8)}}>
          <span style={{fontFamily: ANTON, fontSize: 150, color: C.white, letterSpacing: 3, fontVariantNumeric: 'tabular-nums'}}>{passed}</span>
          <span style={{fontFamily: ANTON, fontSize: 150, color: 'rgba(201,201,209,0.35)', letterSpacing: 3}}>/{flybys.length}</span>
          <span style={{fontFamily: INTER, fontWeight: 800, fontSize: 34, color: C.red, letterSpacing: 8, marginLeft: 22}}>{counterLabel}</span>
        </div>
      )}
    </AbsoluteFill>
  );
};

let worldCache: Promise<any> | null = null;
const EarthRoute: React.FC<RouteProps> = ({title, kicker, route = [], highlight = [], labels = [], drawStart = 0.3, drawDur = 1.4}) => {
  const f = useCurrentFrame();
  const {fps} = useVideoConfig();
  const [world, setWorld] = useState<any>(null);
  const [h] = useState(() => delayRender('world-atlas'));
  useEffect(() => {
    if (!worldCache) worldCache = fetch(staticFile('global/countries-110m.json')).then((r) => r.json());
    worldCache.then((tj) => {
      setWorld(feature(tj, tj.objects.countries));
      continueRender(h);
    });
  }, [h]);
  const t = f / fps;
  const zoom = 1 + 0.06 * ease.inOut(clamp(t / 3));
  const proj = useMemo(() => {
    const pr = geoMercator();
    const bbox = {type: 'MultiPoint', coordinates: route.length ? route : [[-30, -30], [30, 50]]} as GeoPermissibleObjects;
    pr.fitExtent([[140, 560], [940, 1160]], bbox);
    return pr;
  }, [route]);
  const s0 = proj.scale();
  proj.scale(s0 * zoom);
  const path = geoPath(proj);
  const hl = new Set(highlight);
  const p = prog(f, drawStart * fps, (drawStart + drawDur) * fps, ease.inOut);
  // route as great-circle segments
  const seg: [number, number][] = [];
  for (let i = 0; i < route.length - 1; i++) {
    const ip = geoInterpolate(route[i], route[i + 1]);
    for (let k = 0; k <= 40; k++) seg.push(ip(k / 40) as [number, number]);
  }
  const n = Math.max(1, Math.floor(seg.length * p));
  const line = {type: 'LineString', coordinates: seg.slice(0, n)} as GeoPermissibleObjects;
  const headPt = seg.length ? proj(seg[n - 1])! : [0, 0];
  proj.scale(s0);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      <svg width={W} height={1920} style={{position: 'absolute', inset: 0}}>
        {world &&
          world.features.map((ft: any, i: number) => (
            <path key={i} d={path(ft) ?? ''} fill={hl.has(ft.properties.name) ? 'rgba(255,45,45,0.85)' : '#1D1D25'} stroke="#34343F" strokeWidth={1.2} />
          ))}
        {seg.length > 0 && (
          <>
            <path d={path(line) ?? ''} fill="none" stroke={C.red} strokeWidth={12} opacity={0.3} />
            <path d={path(line) ?? ''} fill="none" stroke={C.white} strokeWidth={5} strokeLinecap="round" strokeDasharray="1 0" />
            <circle cx={headPt[0]} cy={headPt[1]} r={11} fill={C.white} />
          </>
        )}
      </svg>
      {labels.map((l, i) => {
        proj.scale(s0 * zoom);
        const xy = proj([l.lon, l.lat])!;
        proj.scale(s0);
        return <Pin key={i} x={xy[0]} y={xy[1]} at={Math.round((drawStart + (i === 0 ? 0 : drawDur)) * fps)} label={l.text} sub={l.sub} side={l.side} size={0.8} lineLen={80} />;
      })}
      <div style={{position: 'absolute', left: 64, right: 64, top: 360, opacity: prog(f, 0, 12)}}>
        {kicker && <Kicker text={kicker} />}
        {title && <div style={{fontFamily: ANTON, fontSize: 96, color: C.white, letterSpacing: 2, lineHeight: 1.05, marginTop: 8}}>{title}</div>}
      </div>
    </AbsoluteFill>
  );
};

export const MapRoute: React.FC<RouteProps> = (p) => (p.mode === 'earth' ? <EarthRoute {...p} /> : <SpaceRoute {...p} />);

export const routeCues = (p: RouteProps): Sfx[] => {
  if (p.mode === 'earth') return [{src: 'sfx/whoosh-fast.mp3', at: p.drawStart ?? 0.3, volume: 0.3}];
  const wps = p.waypoints ?? [];
  if (!wps.length) return [];
  const a0 = wps[0].a, aN = wps[wps.length - 1].a;
  const ds = p.drawStart ?? 0.2, dd = p.drawDur ?? 2.2;
  return wps.filter((w) => w.flyby).map((w) => ({src: 'sfx/tick.mp3', at: ds + ((w.a - a0) / (aN - a0)) * dd, volume: 0.4}));
};
