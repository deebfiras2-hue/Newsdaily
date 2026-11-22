import React, {useMemo} from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {ReelSpec, SceneBase, Sfx, Word} from './spec';
import {C} from './theme';
import {useThemeSetup} from './themes';
import {Narration} from './lineart/LineArt';
import {SCENES} from './scenes';
import {OVERLAP, overlaps, TransitionLayer} from './components/Transition';
import {Captions} from './components/Captions';
import {Finish} from './components/Finish';
import {TopBar} from './components/TopBar';
import {KineticTitle} from './scenes/KineticTitle';
import {clamp, smooth} from './lib/anim';


export type ResolvedProps = ReelSpec & {words: Word[]; durationSec: number};

const DEFAULT_SFX: Record<string, Sfx | null> = {
  whip: {src: 'sfx/whoosh-fast.mp3', at: -0.12, volume: 0.45},
  whipUp: {src: 'sfx/whoosh-fast.mp3', at: -0.12, volume: 0.45},
  zoom: {src: 'sfx/whoosh-deep.mp3', at: -0.22, volume: 0.5},
  bracket: {src: 'sfx/snap.mp3', at: -0.02, volume: 0.5},
  flash: {src: 'sfx/impact-boom.mp3', at: -0.03, volume: 0.6},
  cut: null,
  fade: {src: 'sfx/whoosh-deep.mp3', at: -0.15, volume: 0.22},
};

export const startSec = (s: number | string, words: Word[]) => {
  if (typeof s === 'number') return s;
  const m = /^w(\d+)([+-][\d.]+)?$/.exec(s);
  if (!m) throw new Error('bad start ' + s);
  return words[+m[1]][1] + (m[2] ? +m[2] : 0);
};

export type Timed = SceneBase & {t0: number; t1: number; f0: number; f1: number; idx: number};

export const timeline = (p: ResolvedProps, fps: number): Timed[] => {
  const sc = p.scenes.map((s) => ({...s, t0: startSec(s.start, p.words)}));
  return sc.map((s, i) => {
    const t1 = i + 1 < sc.length ? sc[i + 1].t0 : p.durationSec;
    return {...s, t1, f0: Math.round(s.t0 * fps), f1: Math.round(t1 * fps), idx: i};
  });
};

export const collectSfx = (p: ResolvedProps, tl: Timed[]): Sfx[] => {
  const cues: Sfx[] = [];
  tl.forEach((s, i) => {
    const k = s.transition ?? (i === 0 ? 'cut' : 'whip');
    const d = DEFAULT_SFX[k];
    if (d && i > 0) cues.push({...d, at: s.t0 + d.at});
    const def = SCENES[s.type];
    if (def?.cues) def.cues({...s, sceneStart: s.t0, theme: p.theme}, s.t1 - s.t0, p.words).forEach((c) => cues.push({...c, at: s.t0 + c.at}));
    if (s.overlay) KineticTitle.cues(s.overlay).forEach((c) => cues.push({...c, at: s.t0 + c.at}));
  });
  (p.sfx ?? []).forEach((c) => cues.push(c));
  // de-duplicate near-simultaneous identical cues
  cues.sort((a, b) => a.at - b.at);
  return cues.filter((c, i) => !cues.slice(0, i).some((o) => o.src === c.src && Math.abs(o.at - c.at) < 0.1));
};

const musicVolume = (t: number, words: Word[], m: NonNullable<ReelSpec['music']>, dur: number) => {
  const db = (x: number) => Math.pow(10, x / 20);
  const speech = db(m.speechDb ?? -21), gap = db(m.gapDb ?? -13), tail = db(m.tailDb ?? -8);
  const lastEnd = words[words.length - 1][2];
  let dist = 99;
  for (const [, s, e] of words) {
    const d = t < s ? s - t : t > e ? t - e : 0;
    if (d < dist) dist = d;
    if (s > t + 1) break;
  }
  const k = smooth((dist - 0.12) / 0.45); // 0 speaking .. 1 clear gap
  let v = speech + (gap - speech) * k;
  if (t > lastEnd) v = v + (tail - v) * smooth((t - lastEnd) / 0.8);
  const fadeIn = smooth(t / 0.4), fadeOut = smooth((dur - t) / 1.2);
  return clamp(v * fadeIn * fadeOut, 0, 1);
};

export const Reel: React.FC<ResolvedProps> = (p) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const tl = useMemo(() => timeline(p, fps), [p, fps]);
  const cues = useMemo(() => collectSfx(p, tl), [p, tl]);
  const capHidden = useMemo(() => {
    const ranges = tl.filter((s) => s.captions === false).map((s) => [s.t0, s.t1]);
    return (t: number) => ranges.some(([a, b]) => t >= a - 0.05 && t < b - 0.05);
  }, [tl]);
  const sfxVol = p.sfxVolume ?? 1;
  const theme = useThemeSetup(p.theme);
  const lineart = (p.mode ?? (tl[0]?.type.startsWith('la-') ? 'lineart' : 'graphics')) === 'lineart';
  const narHidden = useMemo(() => {
    const ranges = tl.filter((s) => s.narration === false || s.type === 'la-end' || s.type === 'la-reveal').map((s) => [s.t0, s.t1]);
    return (t: number) => ranges.some(([a, b]) => t >= a - 0.05 && t < b - 0.05);
  }, [tl]);

  return (
    <AbsoluteFill style={{backgroundColor: C.bg}}>
      {tl.map((s, i) => {
        const def = SCENES[s.type];
        if (!def) throw new Error('Unknown scene type ' + s.type);
        const next = tl[i + 1];
        const nextKind = next?.transition ?? 'whip';
        const tail = next && overlaps(nextKind) ? OVERLAP : 0;
        const inKind = s.transition ?? (i === 0 ? 'cut' : 'whip');
        const local = frame - s.f0;
        const inP = overlaps(inKind) || inKind === 'flash' ? clamp(local / OVERLAP) : 1;
        const outP = next ? clamp((frame - next.f0) / OVERLAP) : 0;
        const Comp = def.component;
        return (
          <Sequence key={i} from={s.f0} durationInFrames={s.f1 - s.f0 + tail} name={`${i}:${s.type}`}>
            <TransitionLayer id={String(i)} inKind={inKind} inP={inP} outKind={next ? nextKind : undefined} outP={outP}>
              <Comp {...s} theme={p.theme} dur={s.t1 - s.t0} words={p.words} sceneStart={s.t0} prev={tl[i - 1]} />
              {s.overlay && <KineticTitle {...s.overlay} />}
            </TransitionLayer>
          </Sequence>
        );
      })}
      {!lineart && <TopBar tag={p.tag} date={p.date} brand={theme.id === 'zoomedout' ? undefined : theme.brand} hideFrom={tl.length ? tl[tl.length - 1].f0 : 1e9} />}
      {!lineart && <Captions words={p.words} cfg={p.captions} hidden={capHidden} />}
      {lineart && p.narration !== false && <Narration words={p.words} cfg={p.narration || undefined} hidden={narHidden} theme={p.theme} />}
      <Finish grain={lineart ? 0.07 : undefined} />
      <Audio src={staticFile(p.voice.src)} volume={p.voice.volume ?? 1} />
      {p.music && (
        <Audio
          src={staticFile(p.music.src)}
          startFrom={Math.round((p.music.offset ?? 0) * fps)}
          volume={(f) => musicVolume(f / fps, p.words, p.music!, p.durationSec)}
        />
      )}
      {cues.map((c, i) => (
        <Sequence key={'s' + i} from={Math.max(0, Math.round(c.at * fps))} durationInFrames={Math.round(2.5 * fps)} layout="none">
          <Audio src={staticFile(c.src)} volume={(c.volume ?? 0.5) * sfxVol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
