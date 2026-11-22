// ZOOMED OUT reel spec — the JSON contract between the daily routine and the engine.
export type Word = [string, number, number]; // [text, startSec, endSec] (already speed-adjusted)

export type TransitionKind = 'cut' | 'whip' | 'whipUp' | 'zoom' | 'bracket' | 'flash';

export type SceneBase = {
  type: string;
  /** start time: seconds (number) or "w<index>" = start of that word in words.json */
  start: number | string;
  /** transition INTO this scene (default 'whip') */
  transition?: TransitionKind;
  /** show word captions during this scene (default true) */
  captions?: boolean;
  /** optional kinetic title drawn on top of this scene */
  overlay?: KineticProps;
  [k: string]: unknown;
};

export type KineticLine = {text: string; at: number; red?: string[]; bracket?: string; bracketAt?: number; bracketLabel?: string};
export type KineticProps = {lines: KineticLine[]; exitAt?: number; y?: number; size?: number};

export type Sfx = {src: string; at: number; volume?: number};

export type ReelSpec = {
  id: string;
  fps?: number;
  width?: number;
  height?: number;
  /** total length in seconds (default: last word end + 2.6) */
  duration?: number;
  tag?: string; // small category tag in the top bar, e.g. "SPACE"
  date?: string;
  voice: {src: string; words: Word[] | string; volume?: number};
  music?: {src: string; speechDb?: number; gapDb?: number; tailDb?: number; offset?: number};
  captions?: {
    red?: string[]; // words (case-insensitive, punctuation ignored) drawn in red
    replace?: {from: number; to: number; text: string}[]; // merge word indices [from..to] into one token
    maxWords?: number;
    y?: number;
  };
  scenes: SceneBase[];
  sfx?: Sfx[];
  sfxVolume?: number;
  cover?: {frame: number};
};
