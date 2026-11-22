import React from 'react';
import {useCurrentFrame} from 'remotion';
import {ANTON, C, INTER} from '../theme';
import {Logo} from './Brackets';
import {prog} from '../lib/anim';

/** Persistent brand bug at the top of the safe area. */
export const TopBar: React.FC<{tag?: string; date?: string; brand?: string; hideFrom: number}> = ({tag, date, brand, hideFrom}) => {
  const f = useCurrentFrame();
  const o = prog(f, 4, 16) * (1 - prog(f, hideFrom - 6, hideFrom + 2));
  if (o <= 0) return null;
  return (
    <div style={{position: 'absolute', left: 64, right: 64, top: 262, height: 44, opacity: o * 0.95}}>
      {brand ? (
        <div style={{position: 'absolute', left: 0, top: -2, fontFamily: ANTON, fontSize: 34, letterSpacing: 1, color: C.white}}>{brand}</div>
      ) : (
        <>
          <Logo x={0} y={2} S={38} />
          <div style={{position: 'absolute', left: 54, top: -2, fontFamily: ANTON, fontSize: 34, letterSpacing: 3, color: C.white}}>
            ZOOMED <span style={{color: C.red}}>OUT</span>
          </div>
        </>
      )}
      {(tag || date) && (
        <div style={{position: 'absolute', right: 0, top: 6, fontFamily: INTER, fontWeight: 700, fontSize: 22, letterSpacing: 4, color: C.gray}}>
          {tag && <span style={{color: C.white, border: `2px solid ${C.red}`, padding: '3px 10px', marginRight: date ? 14 : 0}}>{tag}</span>}
          {date}
        </div>
      )}
    </div>
  );
};
