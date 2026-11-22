import React, {useLayoutEffect, useRef} from 'react';
import {W, H} from '../theme';
import {Tex} from '../lib/texture';

const D2R = Math.PI / 180;

export type PlanetLook = {
  /** view centre longitude/latitude in degrees */
  lon: number;
  lat: number;
  /** light direction in view space (x right, y up, z towards camera) */
  light?: [number, number, number];
  ambient?: number;
  tint?: [number, number, number];
  /** rgb 0..255 atmosphere colour (Earth) */
  atmosphere?: [number, number, number] | null;
  contrast?: number;
};

/** project lon/lat (deg) to screen for a sphere at (cx,cy) radius r seen from look.lon/look.lat */
export const project = (lon: number, lat: number, look: {lon: number; lat: number}, cx: number, cy: number, r: number) => {
  const la = lat * D2R, lo = lon * D2R;
  const P = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  const a = -look.lon * D2R;
  const x1 = P[0] * Math.cos(a) + P[2] * Math.sin(a);
  const z1 = -P[0] * Math.sin(a) + P[2] * Math.cos(a);
  const y1 = P[1];
  const t = look.lat * D2R;
  const y2 = y1 * Math.cos(t) - z1 * Math.sin(t);
  const z2 = y1 * Math.sin(t) + z1 * Math.cos(t);
  return {x: cx + x1 * r, y: cy - y2 * r, z: z2};
};

/**
 * Textured, lit sphere drawn per-pixel on a 2D canvas (deterministic, no WebGL needed).
 * Equirectangular texture, bilinear sampling, soft terminator, limb darkening, optional atmosphere.
 */
export const Planet: React.FC<{tex: Tex | null; cx: number; cy: number; r: number; look: PlanetLook; style?: React.CSSProperties}> = ({
  tex,
  cx,
  cy,
  r,
  look,
  style,
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    if (!tex || r < 1) return;
    const pad = look.atmosphere ? r * 0.12 + 4 : 2;
    const x0 = Math.max(0, Math.floor(cx - r - pad)), x1 = Math.min(W, Math.ceil(cx + r + pad));
    const y0 = Math.max(0, Math.floor(cy - r - pad)), y1 = Math.min(H, Math.ceil(cy + r + pad));
    const bw = x1 - x0, bh = y1 - y0;
    if (bw <= 0 || bh <= 0) return;
    const img = g.createImageData(bw, bh);
    const out = img.data;
    const {data, w: tw, h: th} = tex;
    const L = look.light ?? [0.55, 0.35, 0.76];
    const ll = Math.hypot(L[0], L[1], L[2]);
    const lx = L[0] / ll, ly = L[1] / ll, lz = L[2] / ll;
    const amb = look.ambient ?? 0.04;
    const tint = look.tint ?? [1, 1, 1];
    const con = look.contrast ?? 1;
    const atm = look.atmosphere;
    const lon0 = look.lon * D2R, lat0 = look.lat * D2R;
    const cl = Math.cos(lon0), sl = Math.sin(lon0), ct = Math.cos(lat0), st = Math.sin(lat0);
    const inv = 1 / r;
    const TWO_PI = Math.PI * 2;
    for (let py = 0; py < bh; py++) {
      const y = (y0 + py + 0.5 - cy) * inv;
      const yu = -y;
      for (let px = 0; px < bw; px++) {
        const x = (x0 + px + 0.5 - cx) * inv;
        const d2 = x * x + y * y;
        const o = (py * bw + px) * 4;
        if (d2 > 1) {
          if (atm) {
            const d = Math.sqrt(d2);
            const k = Math.max(0, 1 - (d - 1) / 0.1);
            if (k > 0) {
              // light-facing halo
              const dl = Math.max(0, (x / d) * lx + (yu / d) * ly + 0.35);
              const a = k * k * k * 0.75 * Math.min(1, dl * 1.4);
              out[o] = atm[0];
              out[o + 1] = atm[1];
              out[o + 2] = atm[2];
              out[o + 3] = a * 255;
            }
          }
          continue;
        }
        const z = Math.sqrt(1 - d2);
        // view -> globe (inverse of camera rotation)
        const y1 = yu * ct + z * st;
        const z1 = -yu * st + z * ct;
        const gx = x * cl + z1 * sl;
        const gz = -x * sl + z1 * cl;
        const lat = Math.asin(Math.max(-1, Math.min(1, y1)));
        const lon = Math.atan2(gx, gz);
        let u = ((lon + Math.PI) / TWO_PI) * tw - 0.5;
        let v = ((Math.PI / 2 - lat) / Math.PI) * th - 0.5;
        if (u < 0) u += tw;
        if (v < 0) v = 0;
        const ui = Math.floor(u), vi = Math.floor(v);
        const fu = u - ui, fv = v - vi;
        const u2 = ui + 1 >= tw ? 0 : ui + 1;
        const v2 = vi + 1 >= th ? th - 1 : vi + 1;
        const i00 = (vi * tw + ui) * 4, i10 = (vi * tw + u2) * 4, i01 = (v2 * tw + ui) * 4, i11 = (v2 * tw + u2) * 4;
        const w00 = (1 - fu) * (1 - fv), w10 = fu * (1 - fv), w01 = (1 - fu) * fv, w11 = fu * fv;
        let R = data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11;
        let G = data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11;
        let B = data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11;
        if (con !== 1) {
          R = (R - 128) * con + 128;
          G = (G - 128) * con + 128;
          B = (B - 128) * con + 128;
        }
        const ndl = x * lx + yu * ly + z * lz;
        // soft terminator
        let lit = ndl <= -0.12 ? 0 : ndl >= 0.25 ? ndl : ((ndl + 0.12) / 0.37) * 0.25;
        lit = lit * (0.82 + 0.18 * z); // limb darkening
        const s = amb + (1 - amb) * lit * 1.15;
        R *= s * tint[0];
        G *= s * tint[1];
        B *= s * tint[2];
        if (atm) {
          const rim = Math.pow(1 - z, 2.2) * 0.85 * Math.max(0, ndl + 0.3);
          R = R + (atm[0] - R) * rim;
          G = G + (atm[1] - G) * rim;
          B = B + (atm[2] - B) * rim;
        }
        // edge anti-alias
        const edge = Math.min(1, (1 - Math.sqrt(d2)) * r * 1.2);
        out[o] = R;
        out[o + 1] = G;
        out[o + 2] = B;
        out[o + 3] = 255 * edge;
      }
    }
    g.putImageData(img, x0, y0);
  });
  return <canvas ref={ref} width={W} height={H} style={{position: 'absolute', left: 0, top: 0, width: W, height: H, ...style}} />;
};
