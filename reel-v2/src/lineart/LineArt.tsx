// LINEART mode: minimal glowing line-art pictograms that draw on stroke by stroke, a big glowing title,
// a tiny spaced monospace label, typed narration. Scene types: la-title, la-split, la-transform, la-counter,
// la-flow, la-reveal, la-end (all share the same stage: background, camera, header, `items`).
import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {getBoundingBox, getLength} from '@remotion/paths';
import {Sfx, Word} from '../spec';
import {getTheme, Theme} from '../themes';
import {clamp, ease, lerp, smooth} from '../lib/anim';
import {PictoParams, pictoSegs, Seg, circle, rect, line as pline} from './picto';

// ---------------------------------------------------------------- helpers
type TimeRef = number | string;
const wordT = (s: TimeRef, words: Word[]) => {
  if (typeof s === 'number') return s;
  const m = /^w(\d+)([+-][\d.]+)?$/.exec(s);
  if (!m) throw new Error('bad time ' + s);
  return words[Math.min(+m[1], words.length - 1)][1] + (m[2] ? +m[2] : 0);
};
/** scene-relative seconds: numbers are relative to the scene start, "w12" refs are absolute word times */
const rel = (v: TimeRef | undefined, words: Word[], sceneStart: number, d = 0) =>
  v === undefined ? d : typeof v === 'number' ? v : wordT(v, words) - sceneStart;

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c);
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mix = (a: string, b: string, t: number) => {
  const x = hex(a), y = hex(b), k = clamp(t);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
};
const alpha = (c: string, a: number) => `rgba(${hex(c).join(',')},${a})`;

const lenCache = new Map<string, number>();
const plen = (d: string) => {
  let v = lenCache.get(d);
  if (v === undefined) {
    try {
      v = getLength(d);
    } catch {
      v = 100;
    }
    if (lenCache.size > 4000) lenCache.clear();
    lenCache.set(d, v);
  }
  return v;
};

const fontOf = (th: Theme, f?: string) => (f === 'title' ? th.fonts.title : f === 'mono' ? th.fonts.mono : th.fonts.text);
const colorOf = (th: Theme, c?: string) =>
  c === 'accent' ? th.accent : c === 'muted' ? th.muted : c === 'text' ? th.text : c && c.startsWith('#') ? c : th.line;

// ---------------------------------------------------------------- keyframes
type Key = {at: TimeRef; dur?: number; x?: number; y?: number; s?: number; o?: number; dim?: number; lit?: number; pose?: string; walk?: boolean; flip?: boolean};
export type Item = {
  type?: 'picto' | 'text' | 'line' | 'arrow' | 'grid' | 'counter';
  id?: string;
  kind?: string;
  params?: PictoParams;
  x?: number;
  y?: number;
  s?: number;
  flip?: boolean;
  at?: TimeRef;
  dd?: number; // draw duration
  out?: TimeRef; // undraw / fade-out start
  outDur?: number;
  accent?: boolean;
  lit?: number;
  dim?: number;
  o?: number;
  keys?: Key[];
  sfx?: string | false;
  glow?: number;
  // text
  text?: string;
  size?: number;
  font?: 'title' | 'text' | 'mono';
  color?: string;
  align?: 'left' | 'center' | 'right';
  spacing?: number;
  anim?: 'type' | 'fade' | 'words';
  fromWord?: number; // anim 'words': word i of the text appears at voice word fromWord+i
  width?: number;
  weight?: number;
  clip?: [number, number, number, number]; // picto: only show inside this screen rect [x1, y1, x2, y2]
  box?: boolean; // stamp: thin outline + dark plate behind the text
  // line / arrow
  from?: [number, number];
  to?: [number, number] | number;
  bend?: number;
  dashed?: boolean;
  // grid
  w?: number;
  content?: 'full' | 'empty';
  stale?: {at: TimeRef};
  fresh?: {at: TimeRef; step?: number};
  // counter
  value?: number;
  start?: number;
  dur?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
};

type St = {x: number; y: number; s: number; o: number; dim: number; lit: number; pose?: string; phase: number; flip: boolean};
const stateAt = (it: Item, t: number, words: Word[], t0: number): St => {
  const st: St = {x: it.x ?? 540, y: it.y ?? 1100, s: it.s ?? 1, o: it.o ?? 1, dim: it.dim ?? 0, lit: it.lit ?? 0, pose: it.params?.pose, phase: 0, flip: !!it.flip};
  for (const k of it.keys ?? []) {
    const a = rel(k.at, words, t0);
    const d = k.dur ?? 0.6;
    const p = ease.inOut(clamp((t - a) / d));
    for (const prop of ['x', 'y', 's', 'o', 'dim', 'lit'] as const) if (k[prop] !== undefined) st[prop] = lerp(st[prop], k[prop] as number, p);
    if (t >= a) {
      if (k.pose) st.pose = k.pose;
      if (k.flip !== undefined) st.flip = k.flip;
      if (k.walk && t < a + d) {
        st.pose = 'walk';
        st.phase = (t - a) * Math.PI * 2 * 1.5;
      }
    }
  }
  return st;
};

// ---------------------------------------------------------------- drawing primitives
const Strokes: React.FC<{segs: Seg[]; p: number; col: string; acc: string; accOn: number; sw: number; glow?: boolean}> = ({segs, p, col, acc, accOn, sw, glow}) => {
  const lens = segs.map((s) => plen(s.d));
  const total = lens.reduce((a, b) => a + b, 0);
  let cum = 0;
  const accCol = mix(col.startsWith('rgb') ? '#ffffff' : col, acc, accOn);
  return (
    <>
      {segs.map((s, i) => {
        const L = lens[i];
        const fr = clamp((p * total - cum) / Math.max(L, 0.001));
        cum += L;
        if (fr <= 0) return null;
        const c = s.a ? (accOn > 0 ? accCol : col) : col;
        const w = sw * (s.w ?? 1) * (glow ? 2.2 : 1);
        return (
          <path
            key={i}
            d={s.d}
            fill={s.fill ? c : 'none'}
            fillOpacity={s.fill ? fr : 0}
            stroke={c}
            strokeWidth={w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={fr < 1 ? `${L} ${L}` : undefined}
            strokeDashoffset={fr < 1 ? L * (1 - fr) : undefined}
          />
        );
      })}
    </>
  );
};

const TEXT_AT: Record<string, [number, number, number]> = {
  shop: [0, -126.5, 13],
  storefront: [0, -126.5, 13],
  barbershop: [0, -126.5, 13],
  priceTag: [5, 4.5, 12],
  sign: [0, 3, 15],
  door: [0, -66, 9],
};

const bboxCache = new Map<string, {x1: number; y1: number; x2: number; y2: number}>();
const bboxOf = (segs: Seg[]) => {
  const key = segs.map((s) => s.d).join('|');
  let b = bboxCache.get(key);
  if (!b) {
    const bb = getBoundingBox(segs.map((s) => s.d).join(' '));
    b = {x1: bb.x1, y1: bb.y1, x2: bb.x2, y2: bb.y2};
    if (bboxCache.size > 2000) bboxCache.clear();
    bboxCache.set(key, b);
  }
  return b;
};

/** one glowing line-art element in its own SVG (glow = blurred copy, fades in after the strokes are drawn) */
const LineSvg: React.FC<{
  segs: Seg[];
  x: number;
  y: number;
  s: number;
  p: number;
  col: string;
  acc: string;
  accOn: number;
  glow: number;
  flip?: boolean;
  o?: number;
  text?: {t: string; at: [number, number, number]; o: number; col: string; font: string};
  uid: string;
}> = ({segs, x, y, s, p, col, acc, accOn, glow, flip, o = 1, text, uid}) => {
  if (p <= 0 || o <= 0.001) return null;
  const b = bboxOf(segs);
  const pad = 26;
  const vx = b.x1 - pad, vy = b.y1 - pad, vw = b.x2 - b.x1 + 2 * pad, vh = b.y2 - b.y1 + 2 * pad;
  const sw = 3.7 / s;
  return (
    <svg
      width={vw * s}
      height={vh * s}
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      style={{
        position: 'absolute',
        left: x + vx * s,
        top: y + vy * s,
        overflow: 'visible',
        opacity: o,
        transform: flip ? 'scaleX(-1)' : undefined,
        transformOrigin: `${-vx * s}px 0px`,
      }}
    >
      <defs>
        <filter id={`g${uid}`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={6.5 / s} />
        </filter>
      </defs>
      {glow > 0.01 && (
        <g filter={`url(#g${uid})`} opacity={clamp(glow)}>
          <Strokes segs={segs} p={p} col={col} acc={acc} accOn={accOn} sw={sw} glow />
        </g>
      )}
      <Strokes segs={segs} p={p} col={col} acc={acc} accOn={accOn} sw={sw} />
      {text && text.o > 0 && (
        <text
          x={text.at[0]}
          y={text.at[1]}
          fontSize={text.at[2]}
          textAnchor="middle"
          fill={text.col}
          opacity={text.o}
          style={{fontFamily: text.font, fontWeight: 600, letterSpacing: 1.5, transform: flip ? 'scaleX(-1)' : undefined, transformBox: 'fill-box', transformOrigin: 'center'}}
        >
          {text.t}
        </text>
      )}
    </svg>
  );
};

// ---------------------------------------------------------------- elements
type Ctx = {t: number; th: Theme; words: Word[]; t0: number; fps: number; uid: string};

const drawProgress = (it: Item, c: Ctx, defDd = 0.9) => {
  const a = rel(it.at, c.words, c.t0);
  const dd = it.dd ?? defDd;
  let p = clamp((c.t - a) / dd);
  p = ease.inOut(p) * 0.15 + p * 0.85;
  let out = 1;
  if (it.out !== undefined) {
    const oa = rel(it.out, c.words, c.t0);
    out = 1 - clamp((c.t - oa) / (it.outDur ?? 0.45));
  }
  return {a, dd, p, out};
};

const PictoEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const {th} = c;
  const st = stateAt(it, c.t, c.words, c.t0);
  const {a, dd, p, out} = drawProgress(it, c);
  if (p <= 0 || out <= 0) return null;
  const segs = pictoSegs(it.kind ?? 'person', {...it.params, pose: (st.pose as PictoParams['pose']) ?? it.params?.pose, phase: st.phase});
  const col = mix(th.line, th.muted, st.dim * 0.9);
  const accOn = Math.max(it.accent ? 1 : 0, st.lit) * (1 - st.dim);
  const glowIn = smooth((c.t - a - dd * 0.55) / 0.6);
  const glow = (it.glow ?? 0.75) * glowIn * (0.75 + 0.9 * st.lit) * (1 - 0.75 * st.dim);
  const ta = it.params?.text ? TEXT_AT[it.kind ?? ''] : undefined;
  const b = st.lit > 0.01 ? bboxOf(segs) : null;
  const cl = it.clip;
  return (
    <div style={{position: 'absolute', left: 0, top: 0, width: 1080, height: 1920, clipPath: cl ? `inset(${cl[1]}px ${1080 - cl[2]}px ${1920 - cl[3]}px ${cl[0]}px)` : undefined}}>
      {b && (
        <div
          style={{
            position: 'absolute',
            left: st.x + ((b.x1 + b.x2) / 2) * st.s - (b.x2 - b.x1) * st.s,
            top: st.y + ((b.y1 + b.y2) / 2) * st.s - (b.y2 - b.y1) * st.s,
            width: (b.x2 - b.x1) * st.s * 2,
            height: (b.y2 - b.y1) * st.s * 2,
            background: `radial-gradient(closest-side, ${alpha(th.accent, 0.2 * st.lit)}, ${alpha(th.accent, 0)})`,
            opacity: out * st.o,
          }}
        />
      )}
      <LineSvg
        uid={c.uid}
        segs={segs}
        x={st.x}
        y={st.y}
        s={st.s}
        p={p * (out < 1 ? out : 1)}
        col={col}
        acc={th.accent}
        accOn={accOn}
        glow={glow}
        flip={st.flip}
        o={st.o * (1 - 0.5 * st.dim) * (out < 1 ? Math.min(1, out * 1.6) : 1)}
        text={ta ? {t: it.params!.text!, at: ta, o: smooth((c.t - a - dd * 0.7) / 0.4) * out, col, font: th.fonts.mono} : undefined}
      />
    </div>
  );
};

const LineEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const {th} = c;
  const {a, dd, p, out} = drawProgress(it, c, 0.7);
  if (p <= 0 || out <= 0) return null;
  const st = stateAt(it, c.t, c.words, c.t0);
  const [x1, y1] = it.from ?? [80, 1100];
  const to = it.to ?? [1000, 1100];
  const [x2, y2] = typeof to === 'number' ? [to, y1] : to;
  const bend = it.bend ?? 0;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const nx = -(y2 - y1), ny = x2 - x1, nl = Math.hypot(nx, ny) || 1;
  const cx = mx + (nx / nl) * bend, cy = my + (ny / nl) * bend;
  const segs: Seg[] = [{d: bend ? `M${x1} ${y1}Q${cx} ${cy} ${x2} ${y2}` : pline([x1, y1], [x2, y2]), a: it.accent, w: it.type === 'line' ? 0.75 : 0.85}];
  if (it.type === 'arrow') {
    const ang = Math.atan2(y2 - (bend ? cy : y1), x2 - (bend ? cx : x1));
    const h = 16;
    segs.push({d: pline([x2 - h * Math.cos(ang - 0.5), y2 - h * Math.sin(ang - 0.5)], [x2, y2], [x2 - h * Math.cos(ang + 0.5), y2 - h * Math.sin(ang + 0.5)]), a: it.accent});
  }
  const col = mix(th.line, th.muted, st.dim);
  const glowIn = smooth((c.t - a - dd * 0.5) / 0.5);
  return (
    <svg width={1080} height={1920} style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity: st.o * Math.min(1, out * 1.5)}}>
      <defs>
        <filter id={`g${c.uid}`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={6} />
        </filter>
      </defs>
      <g filter={`url(#g${c.uid})`} opacity={glowIn * (it.glow ?? 0.6)}>
        <Strokes segs={segs} p={p} col={col} acc={th.accent} accOn={it.accent ? 1 : st.lit} sw={3.7} glow />
      </g>
      <g strokeDasharray={it.dashed ? '2 14' : undefined}>
        <Strokes segs={segs} p={p} col={col} acc={th.accent} accOn={it.accent ? 1 : st.lit} sw={3.7} />
      </g>
    </svg>
  );
};

/** abstract social-profile grid (avatar, two bio lines, 3×3 tiles) — no logo. `stale` greys it out, `fresh` fills tiles in the accent. */
const GridEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const {th, t} = c;
  const {a, dd, p, out} = drawProgress(it, c, 1.1);
  if (p <= 0 || out <= 0) return null;
  const st = stateAt(it, t, c.words, c.t0);
  const k = (it.w ?? 300) / 100;
  const staleP = it.stale ? smooth((t - rel(it.stale.at, c.words, c.t0)) / 0.7) : 0;
  const fa = it.fresh ? rel(it.fresh.at, c.words, c.t0) : 1e9;
  const step = it.fresh?.step ?? 0.12;
  const col = mix(th.line, th.muted, Math.max(staleP, st.dim) * 0.95);
  const frame: Seg[] = [
    {d: circle(-38, -62, 10)},
    {d: pline([-20, -66], [34, -66]), w: 0.7},
    {d: pline([-20, -57], [16, -57]), w: 0.7},
  ];
  const tiles: React.ReactNode[] = [];
  const tileSegs: Seg[] = [];
  for (let i = 0; i < 9; i++) {
    const tx = -50 + (i % 3) * 34.5, ty = -44 + Math.floor(i / 3) * 34.5;
    tileSegs.push({d: rect(tx, ty, 31, 31, 2.5), w: 0.75});
    const cx = tx + 15.5, cy = ty + 15.5;
    const freshP = it.fresh ? clamp((t - fa - i * step) / 0.25) : 0;
    const full = it.content !== 'empty';
    const contentO = full ? smooth((p - 0.6) / 0.4) : freshP;
    if (contentO > 0) {
      const ccol = freshP > 0 ? th.accent : col;
      const sc = freshP > 0 && freshP < 1 ? 0.6 + 0.4 * ease.snap(freshP) : 1;
      tiles.push(
        <g key={i} opacity={contentO} transform={`translate(${cx} ${cy}) scale(${sc}) translate(${-cx} ${-cy})`}>
          {freshP > 0 && <rect x={tx} y={ty} width={31} height={31} rx={2.5} fill={alpha(th.accent, 0.16)} stroke={th.accent} strokeWidth={3.4 / k} />}
          <path d={circle(cx, cy - 4, 5.2)} fill="none" stroke={ccol} strokeWidth={2.6 / k} />
          <path d={`M${cx - 10} ${cy + 12}Q${cx} ${cy + 1} ${cx + 10} ${cy + 12}`} fill="none" stroke={ccol} strokeWidth={2.6 / k} strokeLinecap="round" />
        </g>,
      );
    }
  }
  const segs = [...frame, ...tileSegs];
  const glow = 0.6 * smooth((t - a - dd * 0.5) / 0.6) * (1 - 0.8 * staleP);
  return (
    <div style={{position: 'absolute', left: 0, top: 0, opacity: out * st.o}}>
      <LineSvg uid={c.uid} segs={segs} x={st.x} y={st.y} s={k * st.s} p={p} col={col} acc={th.accent} accOn={0} glow={glow} />
      <svg
        width={136 * k * st.s}
        height={160 * k * st.s}
        viewBox="-68 -80 136 160"
        style={{position: 'absolute', left: st.x - 68 * k * st.s, top: st.y - 80 * k * st.s, overflow: 'visible', opacity: 1 - 0.55 * staleP}}
      >
        {tiles}
      </svg>
    </div>
  );
};

const TextEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const {th, t} = c;
  const a = rel(it.at, c.words, c.t0);
  const dd = it.dd ?? 0.5;
  const st = stateAt(it, t, c.words, c.t0);
  let out = 1;
  if (it.out !== undefined) out = 1 - smooth((t - rel(it.out, c.words, c.t0)) / (it.outDur ?? 0.35));
  const anim = it.anim ?? (it.font === 'mono' ? 'type' : 'fade');
  const txt = it.text ?? '';
  let shown: React.ReactNode = txt;
  let o = 1, dy = 0;
  if (anim === 'type') {
    const n = Math.floor(clamp((t - a) / Math.max(dd, txt.length * 0.028)) * txt.length + (t >= a ? 1 : 0));
    if (t < a) return null;
    shown = (
      <>
        {txt.slice(0, n)}
        <span style={{opacity: 0}}>{txt.slice(n)}</span>
      </>
    );
  } else if (anim === 'words') {
    const ws = txt.split(' ');
    if (t < a - 0.05 && it.fromWord === undefined) return null;
    shown = ws.map((w, i) => {
      const wt = it.fromWord !== undefined ? c.words[Math.min(it.fromWord + i, c.words.length - 1)][1] - c.t0 : a + i * 0.12;
      const q = smooth((t - wt + 0.02) / 0.12);
      return (
        <span key={i} style={{opacity: q, display: 'inline-block', transform: `translateY(${(1 - q) * 14}px)`, marginRight: '0.26em'}}>
          {w}
        </span>
      );
    });
  } else {
    const q = smooth((t - a) / dd);
    if (q <= 0) return null;
    o = q;
    dy = (1 - q) * 22;
  }
  const color = mix(colorOf(th, it.color).startsWith('#') ? colorOf(th, it.color) : th.line, th.muted, st.dim);
  const size = it.size ?? 56;
  const glow = it.glow ?? (it.font === 'mono' ? 0 : 0.35);
  const align = it.align ?? 'center';
  const w = it.width ?? 940;
  return (
    <div
      style={{
        position: 'absolute',
        left: align === 'center' ? st.x - w / 2 : align === 'right' ? st.x - w : st.x,
        top: st.y + dy,
        width: w,
        textAlign: align,
        fontFamily: fontOf(th, it.font),
        fontWeight: it.weight ?? (it.font === 'mono' ? 500 : it.font === 'title' ? 700 : th.textWeight),
        fontSize: size,
        lineHeight: 1.12,
        letterSpacing: it.spacing ?? (it.font === 'mono' ? 2 : 0),
        color,
        opacity: o * out * st.o,
        whiteSpace: 'pre-wrap',
        textShadow: glow ? `0 0 ${size * 0.35}px ${alpha(colorOf(th, it.color).startsWith('#') ? colorOf(th, it.color) : th.line, glow)}` : undefined,
      }}
    >
      {it.box ? (
        <span style={{display: 'inline-block', padding: '0.18em 0.5em 0.12em 0.62em', border: `3px solid ${color}`, borderRadius: 6, background: alpha(th.bg.warm.base, 0.88)}}>{shown}</span>
      ) : (
        shown
      )}
    </div>
  );
};

const CounterEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const {th, t} = c;
  const a = rel(it.at, c.words, c.t0);
  if (t < a) return null;
  const p = ease.out(clamp((t - a) / (it.dur ?? 1.4)));
  const v = lerp(it.start ?? 0, it.value ?? 100, p);
  const txt = `${it.prefix ?? ''}${v.toFixed(it.decimals ?? 0)}${it.suffix ?? ''}`;
  return <TextEl it={{...it, type: 'text', text: txt, anim: 'fade', dd: 0.25, font: it.font ?? 'mono', size: it.size ?? 150, color: it.color ?? 'line', glow: it.glow ?? 0.4}} c={c} />;
};

export const ItemEl: React.FC<{it: Item; c: Ctx}> = ({it, c}) => {
  const ty = it.type ?? (it.text !== undefined ? 'text' : 'picto');
  if (ty === 'picto') return <PictoEl it={it} c={c} />;
  if (ty === 'line' || ty === 'arrow') return <LineEl it={{...it, type: ty}} c={c} />;
  if (ty === 'grid') return <GridEl it={it} c={c} />;
  if (ty === 'counter') return <CounterEl it={it} c={c} />;
  return <TextEl it={it} c={c} />;
};

// ---------------------------------------------------------------- background, header, camera
export const LABackground: React.FC<{th: Theme; variant?: 'warm' | 'grid'; t: number}> = ({th, variant, t}) => {
  const v = variant ?? th.defaultBg;
  const dx = Math.sin(t * 0.25) * 2.5, dy = Math.cos(t * 0.21) * 2;
  if (v === 'grid') {
    const g = th.bg.grid;
    return (
      <AbsoluteFill style={{background: g.base}}>
        <AbsoluteFill style={{background: `radial-gradient(ellipse 75% 45% at ${50 + dx}% ${46 + dy}%, ${g.glow}, rgba(0,0,0,0) 70%)`}} />
        <AbsoluteFill
          style={{
            backgroundImage: `linear-gradient(${g.grid} 1px, transparent 1px), linear-gradient(90deg, ${g.grid} 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
            backgroundPosition: `${-t * 1.5}px ${-t * 0.8}px`,
            maskImage: 'radial-gradient(ellipse 80% 65% at 50% 48%, #000 35%, transparent 100%)',
          }}
        />
      </AbsoluteFill>
    );
  }
  const w = th.bg.warm;
  return (
    <AbsoluteFill style={{background: w.base}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 70% 42% at ${50 + dx}% ${50 + dy}%, ${w.glow}, rgba(0,0,0,0) 72%)`}} />
      {w.glow2 && <AbsoluteFill style={{background: `radial-gradient(ellipse 40% 26% at ${50 - dx}% ${54 - dy}%, ${w.glow2}, rgba(0,0,0,0) 80%)`}} />}
    </AbsoluteFill>
  );
};

type Label = {at: TimeRef; text: string};
export type LAProps = {
  type: string;
  theme?: string;
  bg?: 'warm' | 'grid';
  title?: string;
  titleY?: number;
  titleSize?: number;
  label?: string;
  labels?: Label[];
  labelY?: number;
  items?: Item[];
  camera?: {at: TimeRef; dur?: number; x?: number; y?: number; s?: number}[];
  drift?: number;
  dur: number;
  words: Word[];
  sceneStart: number;
  prev?: {title?: string; label?: string; labels?: Label[]; type?: string};
  [k: string]: unknown;
};

const Header: React.FC<{p: LAProps; c: Ctx}> = ({p, c}) => {
  const {th, t} = c;
  const els: React.ReactNode[] = [];
  const ty = p.titleY ?? 285;
  const size = p.titleSize ?? th.titleSize;
  if (p.title) {
    const same = p.prev?.title === p.title;
    const q = same ? 1 : smooth((t - 0.05) / 0.55);
    const txt = th.titleUpper ? p.title.toUpperCase() : p.title;
    els.push(
      <div
        key="t"
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: ty + (1 - q) * 26,
          textAlign: 'center',
          fontFamily: th.fonts.title,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1,
          letterSpacing: th.titleSpacing,
          color: th.text,
          opacity: q,
          filter: q < 1 ? `blur(${(1 - q) * 10}px)` : undefined,
          textShadow: `0 0 26px ${alpha(th.line, 0.45)}, 0 0 60px ${alpha(th.line, 0.18)}`,
        }}
      >
        {txt}
      </div>,
    );
  }
  const labels: Label[] = p.labels ?? (p.label ? [{at: 0, text: p.label}] : []);
  const prevLast = p.prev?.labels?.length ? p.prev.labels[p.prev.labels.length - 1].text : p.prev?.label;
  let cur: {text: string; a: number} | null = null, nxt = 1e9;
  labels.forEach((l, i) => {
    const a = rel(l.at, c.words, c.t0);
    if (t >= a) {
      cur = {text: l.text, a};
      nxt = i + 1 < labels.length ? rel(labels[i + 1].at, c.words, c.t0) : 1e9;
    }
  });
  if (cur) {
    const {text, a} = cur as {text: string; a: number};
    const same = a <= 0.001 && prevLast === text;
    const n = same ? text.length : Math.floor(clamp((t - a - 0.1) / (text.length * 0.022)) * text.length);
    const fade = 1 - smooth((t - (nxt - 0.18)) / 0.18);
    els.push(
      <div
        key="l"
        style={{
          position: 'absolute',
          left: 40,
          right: 40,
          top: p.labelY ?? ty + size * 1.04 + 12,
          textAlign: 'center',
          fontFamily: th.fonts.mono,
          fontWeight: 500,
          fontSize: 28,
          letterSpacing: 5,
          color: th.muted === '#5F7F78' ? '#9DB8A4' : mix(th.line, th.muted, 0.35),
          opacity: 0.95 * fade,
          whiteSpace: 'pre',
        }}
      >
        {text.slice(0, n)}
        <span style={{opacity: 0}}>{text.slice(n)}</span>
      </div>,
    );
  }
  return <>{els}</>;
};

const cameraAt = (p: LAProps, c: Ctx) => {
  let x = 540, y = 900, s = 1;
  for (const k of p.camera ?? []) {
    const a = rel(k.at, c.words, c.t0);
    const q = ease.inOut(clamp((c.t - a) / (k.dur ?? 1)));
    if (k.x !== undefined) x = lerp(x, k.x, q);
    if (k.y !== undefined) y = lerp(y, k.y, q);
    if (k.s !== undefined) s = lerp(s, k.s, q);
  }
  const drift = p.drift ?? 0.035;
  s *= 1 + drift * smooth(c.t / Math.max(1, p.dur));
  return {x, y, s};
};

const useCtx = (p: LAProps): Ctx => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {t: frame / fps, th: getTheme(p.theme), words: p.words, t0: p.sceneStart, fps, uid: ''};
};

const Stage: React.FC<{p: LAProps; c: Ctx; items: Item[]; children?: React.ReactNode; front?: React.ReactNode}> = ({p, c, items, children, front}) => {
  const cam = cameraAt(p, c);
  return (
    <AbsoluteFill>
      <LABackground th={c.th} variant={p.bg} t={c.t + c.t0} />
      {/* keep the header zone clean: the stage fades out under the title/label (matters during camera pushes) */}
      <AbsoluteFill style={p.title ? {maskImage: `linear-gradient(to bottom, transparent ${(p.titleY ?? 285) + 200}px, #000 ${(p.titleY ?? 285) + 320}px)`} : undefined}>
        <AbsoluteFill style={{transform: `translate(${540 - cam.x}px, ${900 - cam.y}px) scale(${cam.s})`, transformOrigin: `${cam.x}px ${cam.y}px`}}>
          {items.map((it, i) => (
            <ItemEl key={i} it={it} c={{...c, uid: `${Math.round(c.t0 * 100)}_${i}`}} />
          ))}
          {children}
        </AbsoluteFill>
      </AbsoluteFill>
      <Header p={p} c={c} />
      {front}
    </AbsoluteFill>
  );
};

// ---------------------------------------------------------------- scenes
/** la-title: big centred title (+ mono label) with optional items. */
export const LATitle: React.FC<LAProps & {sub?: string}> = (p) => {
  const c = useCtx(p);
  return <Stage p={{...p, titleY: p.titleY ?? 640, titleSize: p.titleSize ?? c.th.titleSize * 1.35}} c={c} items={p.items ?? []} />;
};

/** la-split: A-vs-B composition on one ground line (or two rows with `divider`), side labels, then one side changes via item keys. */
export const LASplit: React.FC<LAProps & {ground?: number | false; groundFrom?: number; groundTo?: number; divider?: boolean; sides?: [string, string]; sidesY?: number}> = (p) => {
  const c = useCtx(p);
  const items: Item[] = [];
  if (p.ground !== false && p.ground !== undefined)
    items.push({type: 'line', from: [p.groundFrom ?? 70, p.ground], to: p.groundTo ?? 1010, at: 0, dd: 0.8, sfx: false, glow: 0.4});
  if (p.divider) items.push({type: 'line', from: [540, 560], to: [540, 1160], at: 0.1, dd: 0.7, dashed: true, sfx: false, glow: 0.2});
  if (p.sides)
    p.sides.forEach((s, i) => items.push({type: 'text', text: s, font: 'mono', size: 28, spacing: 5, color: c.th.id === 'chispa' ? '#9DB8A4' : 'muted', x: i ? 810 : 270, y: p.sidesY ?? (typeof p.ground === 'number' ? p.ground + 26 : 1170), at: 0.3, sfx: false}));
  return <Stage p={p} c={c} items={[...items, ...(p.items ?? [])]} />;
};

/** la-transform: pictogram `from` undraws while `to` draws in its place (with a small pop), e.g. phone -> storefront. */
export const LATransform: React.FC<LAProps & {from: Item; to: Item; morphAt: TimeRef}> = (p) => {
  const c = useCtx(p);
  const m = rel(p.morphAt, c.words, c.t0);
  const pop = (it: Item, s0: number, s1: number): Item => ({...it, keys: [...(it.keys ?? []), {at: m, dur: 0.5, s: (it.s ?? 1) * s1}], s: (it.s ?? 1) * s0});
  const a: Item = {...pop(p.from, 1, 0.85), out: m, outDur: 0.45};
  const b: Item = {...pop(p.to, 0.8, 1), at: m + 0.15, dd: p.to.dd ?? 0.9};
  return <Stage p={p} c={c} items={[...(p.items ?? []), a, b]} />;
};

/** la-counter: big monospace number counting up + small label, optional items around it. */
export const LACounter: React.FC<LAProps & {value: number; start?: number; at?: TimeRef; countDur?: number; prefix?: string; suffix?: string; decimals?: number; caption?: string; y?: number}> = (p) => {
  const c = useCtx(p);
  const y = p.y ?? 760;
  const items: Item[] = [
    {type: 'counter', value: p.value, start: p.start ?? 0, at: p.at ?? 0.2, dur: p.countDur ?? 1.4, prefix: p.prefix, suffix: p.suffix, decimals: p.decimals, x: 540, y, size: 170, sfx: false},
  ];
  if (p.caption) items.push({type: 'text', text: p.caption, font: 'mono', size: 26, spacing: 6, color: 'muted', x: 540, y: y + 210, at: (typeof p.at === 'number' ? p.at : 0.2) + 0.4});
  return <Stage p={p} c={c} items={[...items, ...(p.items ?? [])]} />;
};

/** la-flow: pictograms in a row/column connected by arrows that draw one after another. */
export const LAFlow: React.FC<LAProps & {nodes: {kind: string; label?: string; params?: PictoParams; accent?: boolean; s?: number}[]; at?: number; step?: number; dir?: 'h' | 'v'; y?: number}> = (p) => {
  const c = useCtx(p);
  const n = p.nodes.length;
  const step = p.step ?? 0.8, a0 = p.at ?? 0.2;
  const items: Item[] = [];
  const pos = (i: number): [number, number] =>
    p.dir === 'v' ? [540, 560 + (i * 640) / Math.max(1, n - 1)] : [140 + (i * 800) / Math.max(1, n - 1), p.y ?? 860];
  p.nodes.forEach((nd, i) => {
    const [x, y] = pos(i);
    items.push({kind: nd.kind, params: nd.params, x, y, s: nd.s ?? (n > 3 ? 1.5 : 2), at: a0 + i * step, dd: 0.6, accent: nd.accent});
    if (nd.label)
      items.push({type: 'text', text: nd.label, font: 'mono', size: 22, spacing: 4, color: 'muted', x, y: p.dir === 'v' ? y - 14 : y + 90, width: 260, at: a0 + i * step + 0.35, align: 'center'});
    if (i < n - 1) {
      const [x2, y2] = pos(i + 1);
      const gap = p.dir === 'v' ? [0, 80] : [70, 0];
      items.push({type: 'arrow', from: [x + gap[0], y + gap[1]], to: [x2 - gap[0], y2 - gap[1]], at: a0 + i * step + 0.4, dd: 0.4, sfx: 'sfx/whoosh-fast.mp3'});
    }
  });
  return <Stage p={p} c={c} items={[...items, ...(p.items ?? [])]} />;
};

/** la-reveal: a statement revealed word by word in sync with the voice, accent word + underline drawing under it. */
export const LAReveal: React.FC<LAProps & {lines: {text: string; fromWord?: number; at?: TimeRef; size?: number; font?: 'title' | 'text'; accent?: string[]; y?: number}[]; y?: number}> = (p) => {
  const c = useCtx(p);
  const {th, t} = c;
  let y = p.y ?? 430;
  const blocks = p.lines.map((ln, li) => {
    const size = ln.size ?? (ln.font === 'text' ? 58 : th.titleSize * 1.02);
    const font = ln.font === 'text' ? th.fonts.text : th.fonts.title;
    const ws = ln.text.split(' ');
    const by = ln.y ?? y;
    y = by + size * 1.15 * Math.ceil(ln.text.length / (ln.font === 'text' ? 30 : 18)) + 30;
    return (
      <div
        key={li}
        style={{position: 'absolute', left: 70, right: 70, top: by, textAlign: 'center', fontFamily: font, fontWeight: 700, fontSize: size, lineHeight: 1.08, color: th.text}}
      >
        {ws.map((w, i) => {
          const wt = ln.fromWord !== undefined ? c.words[Math.min(ln.fromWord + i, c.words.length - 1)][1] - c.t0 : rel(ln.at, c.words, c.t0, 0.2) + i * 0.14;
          const q = smooth((t - wt + 0.03) / 0.14);
          const acc = (ln.accent ?? []).some((x) => w.toLowerCase().replace(/[^\p{L}\d]/gu, '') === x.toLowerCase().replace(/[^\p{L}\d]/gu, ''));
          const ul = acc ? ease.inOut(clamp((t - wt - 0.25) / 0.5)) : 0;
          return (
            <span
              key={i}
              style={{
                display: 'inline-block',
                position: 'relative',
                marginRight: '0.24em',
                opacity: q,
                transform: `translateY(${(1 - q) * 20}px)`,
                filter: q < 1 ? `blur(${(1 - q) * 8}px)` : undefined,
                color: acc ? th.accent : th.text,
                textShadow: `0 0 ${size * 0.3}px ${alpha(acc ? th.accent : th.line, acc ? 0.5 : 0.35)}`,
              }}
            >
              {w}
              {acc && (
                <span
                  style={{position: 'absolute', left: 0, bottom: -size * 0.04, height: 5, width: `${ul * 100}%`, background: th.accent, borderRadius: 3, boxShadow: `0 0 14px ${alpha(th.accent, 0.7)}`}}
                />
              )}
            </span>
          );
        })}
      </div>
    );
  });
  return <Stage p={p} c={c} items={p.items ?? []} front={blocks} />;
};

/** la-end: theme end card — logo/wordmark, sign-off typed in sync with the voice, small AI-voice note. */
export const LAEnd: React.FC<LAProps & {signoff?: string; fromWord?: number; outro?: string; outroWord?: number; note?: string}> = (p) => {
  const c = useCtx(p);
  const {th, t} = c;
  const e = th.end;
  const q = ease.out(clamp((t - 0.1) / 0.9));
  const outroT = p.outroWord !== undefined ? c.words[Math.min(p.outroWord, c.words.length - 1)][1] - c.t0 : 1e9;
  const pulse = Math.exp(-Math.max(0, t - outroT) * 3) * (t >= outroT ? 1 : 0);
  const signoff = p.signoff ?? e.signoff;
  const note = p.note ?? e.sub;
  const logo = e.logo ? (
    <Img
      src={staticFile(e.logo)}
      style={{
        position: 'absolute',
        left: 540 - (e.logoW ?? 600) / 2,
        top: 600 + (1 - q) * 30,
        width: e.logoW ?? 600,
        opacity: q,
        filter: `drop-shadow(0 0 ${18 + 30 * pulse}px ${alpha(th.line, 0.25 + 0.3 * pulse)})`,
        transform: `scale(${1 + 0.04 * pulse})`,
      }}
    />
  ) : (
    <div
      style={{
        position: 'absolute',
        left: 40,
        right: 40,
        top: 700 + (1 - q) * 30,
        textAlign: 'center',
        fontFamily: th.fonts.title,
        fontWeight: 700,
        fontSize: th.titleSize * 1.1,
        color: th.text,
        opacity: q,
        textShadow: `0 0 30px ${alpha(th.line, 0.4)}`,
      }}
    >
      {th.titleUpper ? (e.wordmark ?? '').toUpperCase() : e.wordmark}
    </div>
  );
  const items: Item[] = [{type: 'line', from: [380, 1000], to: [700, 1000], at: 0.5, dd: 0.7, glow: 0.4, sfx: false}];
  if (signoff)
    items.push({type: 'text', text: signoff, anim: 'words', fromWord: p.fromWord, at: 0.6, x: 540, y: 1050, size: 46, font: 'text', width: 1000});
  if (p.outro) items.push({type: 'text', text: p.outro, anim: 'fade', at: outroT, dd: 0.3, x: 540, y: 1135, size: th.titleSize * 0.8, font: 'title', width: 900});
  if (e.handle) items.push({type: 'text', text: e.handle, font: 'mono', size: 30, spacing: 4, x: 540, y: 1150, at: 0.9, color: 'muted'});
  if (note) items.push({type: 'text', text: note, font: 'mono', size: 24, spacing: 3, x: 540, y: 1420, at: 1.0, color: 'muted', anim: 'fade'});
  return (
    <Stage p={{...p, title: undefined, label: undefined, labels: undefined, drift: p.drift ?? 0.02}} c={c} items={[...items, ...(p.items ?? [])]} front={logo} />
  );
};

// ---------------------------------------------------------------- SFX cues (soft tick on draws, pop on accents, whoosh on camera pushes)
export const laCues = (p: LAProps, _dur: number, words?: Word[]): Sfx[] => {
  const w = words ?? p.words ?? [];
  const t0 = p.sceneStart ?? 0;
  const out: Sfx[] = [];
  const r = (v: TimeRef | undefined, d = 0) => (v === undefined ? d : typeof v === 'number' ? v : w.length ? wordT(v, w) - t0 : d);
  const all: Item[] = [...(p.items ?? [])];
  if (p.type === 'la-transform') {
    const pp = p as unknown as {from: Item; to: Item; morphAt: TimeRef};
    out.push({src: 'sfx/whoosh-deep.mp3', at: r(pp.morphAt) - 0.1, volume: 0.22});
    all.push({...pp.to, at: r(pp.morphAt) + 0.15});
  }
  for (const it of all) {
    if (it.sfx === false) continue;
    const ty = it.type ?? (it.text !== undefined ? 'text' : 'picto');
    if (ty === 'text' && !it.sfx) continue;
    if (it.sfx || ty === 'picto' || ty === 'grid') out.push({src: it.sfx || 'sfx/tick.mp3', at: r(it.at), volume: it.sfx ? 0.22 : 0.16});
    for (const k of it.keys ?? []) {
      if ((k.lit ?? 0) > 0.5) out.push({src: 'sfx/pop.mp3', at: r(k.at), volume: 0.3});
      if (k.walk) out.push({src: 'sfx/whoosh-fast.mp3', at: r(k.at), volume: 0.1});
    }
    if (it.fresh) for (let i = 0; i < 9; i += 2) out.push({src: 'sfx/pop.mp3', at: r(it.fresh.at) + i * (it.fresh.step ?? 0.12), volume: 0.14});
    if (it.stale) out.push({src: 'sfx/snap.mp3', at: r(it.stale.at), volume: 0.18});
  }
  for (const k of p.camera ?? []) if ((k.s ?? 1) > 1.3) out.push({src: 'sfx/whoosh-deep.mp3', at: r(k.at), volume: 0.28});
  if (p.type === 'la-end') out.push({src: 'sfx/whoosh-deep.mp3', at: 0, volume: 0.25});
  return out;
};

// ---------------------------------------------------------------- narration (typed word by word, one sentence at a time)
export type NarrationCfg = {pos?: 'bottom' | 'top'; x?: number; y?: number; size?: number; width?: number};
export const Narration: React.FC<{words: Word[]; cfg?: NarrationCfg; hidden: (t: number) => boolean; theme?: string}> = ({words, cfg, hidden, theme}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const th = getTheme(theme);
  const t = frame / fps;
  const sents = React.useMemo(() => {
    const out: {w: Word[]; s: number; e: number}[] = [];
    let cur: Word[] = [];
    words.forEach((w) => {
      cur.push(w);
      if (/[.!?]["“”»]?$/.test(w[0])) {
        out.push({w: cur, s: cur[0][1], e: w[2]});
        cur = [];
      }
    });
    if (cur.length) out.push({w: cur, s: cur[0][1], e: cur[cur.length - 1][2]});
    return out;
  }, [words]);
  const i = sents.findIndex((s, k) => t >= s.s - 0.06 && t < (k + 1 < sents.length ? sents[k + 1].s - 0.06 : s.e + 1.2));
  if (i < 0) return null;
  const s = sents[i];
  if (hidden(s.s + 0.01)) return null;
  const end = i + 1 < sents.length ? Math.min(sents[i + 1].s - 0.06, s.e + 1.4) : s.e + 1.2;
  const fadeOut = 1 - smooth((t - (end - 0.14)) / 0.14);
  const size = cfg?.size ?? 58;
  const top = cfg?.pos === 'top';
  return (
    <div
      style={{
        position: 'absolute',
        left: cfg?.x ?? 72,
        width: cfg?.width ?? 900,
        ...(top ? {top: cfg?.y ?? 560} : {bottom: 1920 - (cfg?.y ?? 1470)}),
        fontFamily: th.fonts.text,
        fontWeight: th.textWeight,
        fontSize: size,
        lineHeight: 1.16,
        color: th.text,
        opacity: fadeOut,
        textShadow: `0 0 18px ${alpha(th.line, 0.22)}, 0 2px 10px rgba(0,0,0,0.55)`,
      }}
    >
      {s.w.map((w, k) => {
        const q = clamp((t - w[1] + 0.03) / 0.07);
        return (
          <span key={k} style={{opacity: q, marginRight: '0.25em', display: 'inline-block'}}>
            {w[0]}
          </span>
        );
      })}
    </div>
  );
};
