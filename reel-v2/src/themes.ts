// Theme system: one spec field `"theme": "zoomedout" | "behindthebrand" | "chispa"` picks colours, fonts, logo
// and end card for BOTH modes (GRAPHICS = the photo/news scenes, LINEART = the la-* line-art scenes).
import {continueRender, delayRender, staticFile} from 'remotion';
import {C} from './theme';

/** default when a spec has no "theme" (each repo's copy of the engine sets its own) */
export const DEFAULT_THEME = 'zoomedout';

export type FontFile = {family: string; url: string; weight?: string; range?: string};
export type Theme = {
  id: string;
  brand: string; // shown in the GRAPHICS top bar for non-ZOOMED OUT themes
  /** colours for line-art */
  line: string; // stroke colour of pictograms (off-white)
  accent: string; // the ONE accent colour
  muted: string; // dimmed / greyed-out strokes, small labels
  text: string; // narration + titles
  bg: {warm: {base: string; glow: string; glow2?: string}; grid: {base: string; grid: string; glow: string}};
  defaultBg: 'warm' | 'grid';
  fonts: {title: string; text: string; mono: string};
  titleUpper: boolean; // ZOOMED OUT shouts in caps, Chispa uses mixed case (Karantina has no capital ß)
  titleSize: number;
  titleSpacing: number;
  textWeight: number;
  files: FontFile[];
  /** overrides for the GRAPHICS-mode palette (src/theme.ts C) */
  graphics: Partial<typeof C>;
  end: {logo?: string; logoW?: number; wordmark?: string; signoff?: string; sub?: string; handle?: string};
};

const MONO: FontFile[] = [
  {family: 'LA-Mono', url: 'themes/common/JetBrainsMono-500.woff2', weight: '400 700', range: 'U+0000-00FF,U+2000-206F,U+20AC'},
  {family: 'LA-Mono', url: 'themes/common/JetBrainsMono-500-ext.woff2', weight: '400 700', range: 'U+0100-024F,U+1E00-1EFF'},
];

export const THEMES: Record<string, Theme> = {
  zoomedout: {
    id: 'zoomedout',
    brand: 'ZOOMED OUT',
    line: '#F4F1EA',
    accent: '#FF2D2D',
    muted: '#6E6E78',
    text: '#FFFFFF',
    bg: {warm: {base: '#09090C', glow: 'rgba(255,176,120,0.13)'}, grid: {base: '#070B16', grid: 'rgba(150,180,255,0.06)', glow: 'rgba(80,120,255,0.10)'}},
    defaultBg: 'grid',
    fonts: {title: 'ZO-Anton', text: 'ZO-Inter', mono: 'LA-Mono'},
    titleUpper: true,
    titleSize: 120,
    titleSpacing: 2,
    textWeight: 800,
    files: [
      {family: 'ZO-Anton', url: 'fonts/Anton-Regular.ttf'},
      {family: 'ZO-Inter', url: 'fonts/Inter.ttf', weight: '100 900'},
      ...MONO,
    ],
    graphics: {},
    end: {wordmark: 'ZOOMED OUT', handle: '@zoomed.out.365', sub: 'FOLLOW FOR THE BIG PICTURE'},
  },
  behindthebrand: {
    id: 'behindthebrand',
    brand: 'BEHIND THE BRAND',
    line: '#F3EEE4',
    accent: '#0E9F6E',
    muted: '#77736B',
    text: '#F3EEE4',
    bg: {warm: {base: '#111111', glow: 'rgba(243,226,196,0.10)'}, grid: {base: '#0E1312', grid: 'rgba(243,238,228,0.05)', glow: 'rgba(14,159,110,0.08)'}},
    defaultBg: 'warm',
    fonts: {title: 'BTB-Gelasio', text: 'BTB-Barlow', mono: 'LA-Mono'},
    titleUpper: false,
    titleSize: 112,
    titleSpacing: 0,
    textWeight: 700,
    files: [
      {family: 'BTB-Gelasio', url: 'themes/behindthebrand/Gelasio-VF.ttf', weight: '400 700'},
      {family: 'BTB-Barlow', url: 'themes/behindthebrand/Barlow-Bold.ttf', weight: '700'},
      // graphics mode renders with the ZOOMED OUT family names -> alias them to the brand fonts
      {family: 'ZO-Anton', url: 'themes/behindthebrand/Gelasio-VF.ttf', weight: '400 700'},
      {family: 'ZO-Inter', url: 'themes/behindthebrand/Barlow-Bold.ttf', weight: '100 900'},
      ...MONO,
    ],
    graphics: {bg: '#111111', red: '#0E9F6E', white: '#F3EEE4', gray: '#CFC8BA', muted: '#8C857A', line: 'rgba(243,238,228,0.18)', panel: '#1B1A18'},
    end: {wordmark: 'Behind the Brand', sub: 'The story behind the logo.'},
  },
  chispa: {
    id: 'chispa',
    brand: 'Chispa Studio',
    line: '#EEF4EF', // Nebel
    accent: '#FF8A3D', // Funke — the ONLY accent
    muted: '#5F7F78',
    text: '#EEF4EF',
    bg: {
      warm: {base: '#0B2125', glow: 'rgba(15,85,96,0.85)', glow2: 'rgba(255,138,61,0.045)'}, // Tinte + Petrol glow
      grid: {base: '#0B2125', grid: 'rgba(157,184,164,0.07)', glow: 'rgba(15,85,96,0.55)'},
    },
    defaultBg: 'warm',
    fonts: {title: 'CH-Karantina', text: 'CH-Noto', mono: 'LA-Mono'},
    titleUpper: false,
    titleSize: 150,
    titleSpacing: 1,
    textWeight: 700,
    files: [
      {family: 'CH-Karantina', url: 'themes/chispa/Karantina-700-latin.woff2', weight: '700', range: 'U+0000-00FF,U+2000-206F,U+20AC'},
      {family: 'CH-Karantina', url: 'themes/chispa/Karantina-700-latin-ext.woff2', weight: '700', range: 'U+0100-024F,U+1E00-1EFF'},
      {family: 'CH-Noto', url: 'themes/chispa/NotoSans-700-latin.woff2', weight: '100 900'},
      {family: 'ZO-Anton', url: 'themes/chispa/Karantina-700-latin.woff2'},
      {family: 'ZO-Inter', url: 'themes/chispa/NotoSans-700-latin.woff2', weight: '100 900'},
      ...MONO,
    ],
    graphics: {bg: '#0B2125', red: '#FF8A3D', white: '#EEF4EF', gray: '#9DB8A4', muted: '#6F8F86', line: 'rgba(238,244,239,0.16)', panel: '#0F2E33'},
    end: {
      logo: 'themes/chispa/chispa-de-wordmark-color-on-dark.png',
      logoW: 620,
      signoff: 'Content, der den Daumen stoppt.',
      sub: 'Stimme mit KI erstellt',
    },
  },
};

export const getTheme = (id?: string): Theme => THEMES[id ?? DEFAULT_THEME] ?? THEMES[DEFAULT_THEME];

const loaded: Partial<Record<string, Promise<void>>> = {};
/** registers the theme's fonts once (blocks rendering until they are ready) and applies its graphics palette */
export const useThemeSetup = (id?: string) => {
  const t = getTheme(id);
  Object.assign(C, BASE_C, t.graphics);
  if (typeof document === 'undefined' || loaded[t.id]) return t;
  const h = delayRender('theme fonts ' + t.id);
  loaded[t.id] = Promise.all(
    t.files.map((f) => {
      const ff = new FontFace(f.family, `url(${staticFile(f.url)})`, {
        ...(f.weight ? {weight: f.weight} : {}),
        ...(f.range ? {unicodeRange: f.range} : {}),
      });
      return ff.load().then((x) => (document.fonts as unknown as Set<FontFace>).add(x));
    }),
  )
    .then(() => document.fonts.ready)
    .then(() => continueRender(h))
    .catch((e) => {
      console.error(e);
      continueRender(h);
    });
  return t;
};
const BASE_C = {...C};
