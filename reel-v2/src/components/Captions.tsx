import React, {useMemo} from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {C, INTER} from '../theme';
import {pop} from '../lib/anim';
import {ReelSpec, Word} from '../spec';

type Tok = {text: string; s: number; e: number; red: boolean; brk: boolean};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\-']/g, '').replace(/'s$/, '');

export const buildTokens = (words: Word[], cfg: ReelSpec['captions']): Tok[] => {
  const rep = new Map((cfg?.replace ?? []).map((r) => [r.from, r]));
  const red = new Set((cfg?.red ?? []).map(norm));
  const toks: Tok[] = [];
  for (let i = 0; i < words.length; i++) {
    const [w, s, e] = words[i];
    const r = rep.get(i);
    let text = w;
    let end = e;
    let last = w;
    if (r) {
      text = r.text;
      end = words[r.to][2];
      last = words[r.to][0];
      i = r.to;
    }
    const brk = /[.,:;?!]$/.test(last);
    const display = text.replace(/[,;:]$/, '');
    toks.push({text: display, s, e: end, red: red.has(norm(text)), brk: /[.?!:]$/.test(last) || (brk && false)});
  }
  return toks;
};

type Group = {toks: Tok[]; s: number; e: number};

export const buildGroups = (toks: Tok[], maxWords = 3, maxChars = 17): Group[] => {
  const groups: Group[] = [];
  let cur: Tok[] = [];
  const flush = () => {
    if (cur.length) groups.push({toks: cur, s: cur[0].s, e: cur[cur.length - 1].e});
    cur = [];
  };
  toks.forEach((t, i) => {
    const chars = cur.reduce((a, b) => a + b.text.length + 1, 0) + t.text.length;
    const gap = cur.length ? t.s - cur[cur.length - 1].e : 0;
    if (cur.length && (cur.length >= maxWords || chars > maxChars || gap > 0.32)) flush();
    cur.push(t);
    if (t.brk || /[,]$/.test(t.text)) flush();
    if (i === toks.length - 1) flush();
  });
  // each group stays until the next starts (max +0.6 s)
  groups.forEach((g, i) => {
    const next = groups[i + 1];
    g.e = next ? Math.min(next.s, g.e + 0.6) : g.e + 0.5;
  });
  return groups;
};

export const Captions: React.FC<{words: Word[]; cfg: ReelSpec['captions']; hidden: (t: number) => boolean}> = ({words, cfg, hidden}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const groups = useMemo(() => buildGroups(buildTokens(words, cfg), cfg?.maxWords ?? 3), [words, cfg]);
  const g = groups.find((x) => t >= x.s - 0.04 && t < x.e);
  if (!g || hidden(t) || hidden(g.s)) return null;
  const gf = Math.round((g.s - 0.04) * fps);
  const y = cfg?.y ?? 1330;
  const enter = pop(frame, fps, gf, 320, 20);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: y,
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '0 16px',
        transform: `translateY(${(1 - enter) * 26}px) scale(${0.94 + 0.06 * enter})`,
        opacity: Math.min(1, enter * 1.5),
      }}
    >
      {g.toks.map((tk, i) => {
        const active = t >= tk.s - 0.03 && t < (g.toks[i + 1]?.s ?? g.e);
        const spoken = t >= tk.s - 0.03;
        const wf = Math.round(tk.s * fps);
        const ap = active ? pop(frame, fps, wf - 1, 420, 22) : 1;
        return (
          <span
            key={i}
            style={{
              position: 'relative',
              fontFamily: INTER,
              fontWeight: 900,
              fontSize: 74,
              lineHeight: 1.18,
              letterSpacing: -1,
              textTransform: 'uppercase',
              color: active ? C.white : tk.red ? C.red : C.white,
              opacity: spoken ? 1 : 0.55,
              padding: '0 14px',
              textShadow: active ? 'none' : '0 4px 18px rgba(0,0,0,0.75), 0 2px 3px rgba(0,0,0,0.6)',
              transform: `scale(${active ? 1 + 0.08 * ap - 0.04 : 1})`,
              display: 'inline-block',
            }}
          >
            {active && (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 6,
                  bottom: 4,
                  background: C.red,
                  borderRadius: 14,
                  zIndex: -1,
                  transform: `scaleX(${0.7 + 0.3 * ap})`,
                  boxShadow: '0 8px 30px rgba(255,45,45,0.35)',
                }}
              />
            )}
            {tk.text}
          </span>
        );
      })}
    </div>
  );
};
