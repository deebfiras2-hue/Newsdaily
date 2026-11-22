import React from 'react';
import {Sfx} from '../spec';
import {ZoomOutOpener, zoomOutCues} from './ZoomOutOpener';
import {KineticScene, KineticTitle} from './KineticTitle';
import {PhotoCard, photoCues} from './PhotoCard';
import {NumberCounter, counterCues} from './NumberCounter';
import {MapRoute, routeCues} from './MapRoute';
import {Timeline, timelineCues} from './Timeline';
import {Bars, barsCues} from './Bars';
import {QuoteCard, quoteCues} from './QuoteCard';
import {EndCard, endCues} from './EndCard';
import {Globe, globeCues} from './Globe';
import {LATitle, LASplit, LATransform, LACounter, LAFlow, LAReveal, LAEnd, laCues} from '../lineart/LineArt';

type Def = {component: React.FC<any>; cues?: (p: any, dur: number, words?: any) => Sfx[]};

/** scene type -> component (+ the SFX it triggers, in seconds relative to scene start) */
export const SCENES: Record<string, Def> = {
  zoomOut: {component: ZoomOutOpener, cues: zoomOutCues},
  kinetic: {component: KineticScene, cues: (p) => KineticTitle.cues(p)},
  photo: {component: PhotoCard, cues: photoCues},
  counter: {component: NumberCounter, cues: counterCues},
  route: {component: MapRoute, cues: routeCues},
  timeline: {component: Timeline, cues: timelineCues},
  bars: {component: Bars, cues: barsCues},
  quote: {component: QuoteCard, cues: quoteCues},
  globe: {component: Globe, cues: globeCues},
  end: {component: EndCard, cues: endCues},
  // LINEART mode (src/lineart/LineArt.tsx)
  'la-title': {component: LATitle, cues: laCues},
  'la-split': {component: LASplit, cues: laCues},
  'la-transform': {component: LATransform, cues: laCues},
  'la-counter': {component: LACounter, cues: laCues},
  'la-flow': {component: LAFlow, cues: laCues},
  'la-reveal': {component: LAReveal, cues: laCues},
  'la-end': {component: LAEnd, cues: laCues},
};
