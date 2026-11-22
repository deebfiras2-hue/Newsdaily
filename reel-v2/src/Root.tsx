import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {Reel, ResolvedProps} from './Reel';
import {ReelSpec, Word} from './spec';
import demo from '../specs/bepicolombo.json';

const resolve: CalculateMetadataFunction<ResolvedProps> = async ({props}) => {
  const fps = props.fps ?? 30;
  let words = props.words as Word[] | undefined;
  if (!words || !words.length) {
    const w = props.voice.words;
    words = typeof w === 'string' ? await (await fetch(staticFile(w))).json() : w;
  }
  const durationSec = props.duration ?? words![words!.length - 1][2] + 2.6;
  return {
    durationInFrames: Math.round(durationSec * fps),
    fps,
    width: props.width ?? 1080,
    height: props.height ?? 1920,
    props: {...props, words: words!, durationSec},
  };
};

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="Reel"
      component={Reel}
      width={1080}
      height={1920}
      fps={30}
      durationInFrames={900}
      defaultProps={{...(demo as unknown as ReelSpec), words: [], durationSec: 30}}
      calculateMetadata={resolve}
    />
  </>
);
