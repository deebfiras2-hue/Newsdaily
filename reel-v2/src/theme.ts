import {continueRender, delayRender, staticFile} from 'remotion';

export const C = {
  bg: '#0B0B0F',
  red: '#FF2D2D',
  white: '#FFFFFF',
  gray: '#C9C9D1',
  muted: '#8A8A95',
  line: 'rgba(201,201,209,0.18)',
  panel: '#15151B',
};
export const W = 1080;
export const H = 1920;
/** safe area for anything that must be read (IG UI covers the rest) */
export const SAFE = {top: 250, bottom: 1920 - 420, side: 64};

export const ANTON = 'ZO-Anton';
export const INTER = 'ZO-Inter';

let fontsPromise: Promise<void> | null = null;
export const loadFonts = () => {
  if (typeof document === 'undefined') return;
  if (fontsPromise) return;
  const h = delayRender('fonts');
  const a = new FontFace(ANTON, `url(${staticFile('fonts/Anton-Regular.ttf')})`);
  const i = new FontFace(INTER, `url(${staticFile('fonts/Inter.ttf')})`, {weight: '100 900'});
  fontsPromise = Promise.all([a.load(), i.load()]).then((fs) => {
    fs.forEach((f) => (document.fonts as unknown as Set<FontFace>).add(f));
    continueRender(h);
  });
  fontsPromise.catch((e) => {
    console.error(e);
    continueRender(h);
  });
};
