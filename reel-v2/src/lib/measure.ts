let ctx: CanvasRenderingContext2D | null = null;
/** text width in px using the loaded brand fonts */
export const measure = (text: string, font: string, size: number, weight = 400, letterSpacing = 0) => {
  if (typeof document === 'undefined') return text.length * size * 0.5;
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx!.font = `${weight} ${size}px ${font}`;
  return ctx!.measureText(text).width + letterSpacing * text.length;
};
