import {useEffect, useState} from 'react';
import {continueRender, delayRender, staticFile} from 'remotion';

export type Tex = {data: Uint8ClampedArray; w: number; h: number};
const cache = new Map<string, Promise<Tex>>();

const load = (src: string): Promise<Tex> => {
  if (!cache.has(src)) {
    cache.set(
      src,
      new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const g = c.getContext('2d', {willReadFrequently: true})!;
          g.drawImage(img, 0, 0);
          res({data: g.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height});
        };
        img.onerror = rej;
        img.src = src.startsWith('http') ? src : staticFile(src);
      }),
    );
  }
  return cache.get(src)!;
};

/** pixel data of an equirectangular texture (for the canvas sphere renderer) */
export const useTexture = (src: string | undefined) => {
  const [tex, setTex] = useState<Tex | null>(null);
  const [handle] = useState(() => (src ? delayRender('texture ' + src, {timeoutInMilliseconds: 120000}) : null));
  useEffect(() => {
    if (!src) return;
    load(src)
      .then((t) => {
        setTex(t);
        if (handle !== null) continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        if (handle !== null) continueRender(handle);
      });
  }, [src, handle]);
  return tex;
};

export const resolveSrc = (src: string) => (src.startsWith('http') ? src : staticFile(src));
