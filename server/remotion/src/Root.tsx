import React from 'react';
import { Composition } from 'remotion';
import { UgCReel, ugcReelSchemaDefaults } from './UgCReel';
import type { UgCReelProps } from './types';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;

function durationFromProps(props: UgCReelProps): number {
  const fromTimeline = (props.timeline || []).reduce(
    (sum, c) => sum + Math.max(0.2, c.srcEnd - c.srcStart),
    0
  );
  const fromBeats = (props.effectBeats || []).reduce(
    (max, b) => Math.max(max, (b.atSec || 0) + (b.durSec || 0)),
    0
  );
  const fromCaps = (props.captions || []).reduce((max, c) => Math.max(max, c.end || 0), 0);
  const sec = Math.max(fromTimeline, fromBeats, fromCaps, 3);
  return Math.max(1, Math.ceil(sec * FPS));
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="UgCReel"
        component={UgCReel}
        durationInFrames={90}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={ugcReelSchemaDefaults}
        calculateMetadata={({ props }) => {
          const p = props as UgCReelProps;
          return {
            durationInFrames: durationFromProps(p),
            fps: FPS,
            width: WIDTH,
            height: HEIGHT,
            props: {
              ...p,
              fps: FPS,
              width: WIDTH,
              height: HEIGHT,
            },
          };
        }}
      />
    </>
  );
};
