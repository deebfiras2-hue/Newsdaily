import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';
import {resolveSrc} from './texture';

const cache = new Map<string, Promise<HTMLImageElement>>();
/** decoded HTMLImageElement for canvas drawing */
export const useImage = (src?: string) => {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [h] = useState(() => (src ? delayRender('img ' + src, {timeoutInMilliseconds: 120000}) : null));
  useEffect(() => {
    if (!src) return;
    if (!cache.has(src))
      cache.set(
        src,
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => i.decode().then(() => res(i), () => res(i));
          i.onerror = rej;
          i.src = resolveSrc(src);
        }),
      );
    cache
      .get(src)!
      .then((i) => {
        setImg(i);
        if (h !== null) continueRender(h);
      })
      .catch((e) => {
        console.error(e);
        if (h !== null) continueRender(h);
      });
  }, [src, h]);
  return img;
};
