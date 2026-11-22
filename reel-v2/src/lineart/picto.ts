// Parametric line-art pictogram library. Every pictogram is a list of SVG path segments drawn in order
// (stroke-dashoffset draw-on). Units: a standing person is ~100 tall. Grounded things (people, buildings,
// furniture, vehicles) have their origin at bottom-centre (y = 0 is the ground, up is negative y);
// floating icons (coin, phone, check …) are centred on the origin. `a: true` marks the accent detail.
export type Seg = {d: string; a?: boolean; fill?: boolean; w?: number /* stroke width multiplier */};
export type PictoParams = {
  pose?: 'stand' | 'walk' | 'point' | 'phone' | 'wave' | 'hold' | 'sit' | 'think';
  phase?: number; // walk cycle phase (radians), animated by the stage while walking
  hair?: 'long' | 'short' | 'bun';
  dress?: boolean;
  vest?: boolean; // accent vest / tie on a person
  tie?: boolean;
  hold?: string; // pictogram kind held in the front hand (scissors, cup, comb …)
  screen?: 'blank' | 'grid' | 'post' | 'lit';
  text?: string; // sign / tag text (rendered by the stage as SVG text)
  n?: number; // count (crowd size, coin stack height, chart bars …)
  open?: boolean; // door / sign states
  pole?: boolean; // barber pole on a shop
  [k: string]: unknown;
};

const f = (n: number) => +n.toFixed(2);
export const circle = (cx: number, cy: number, r: number) =>
  `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0`;
export const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  r <= 0
    ? `M${f(x)} ${f(y)}h${f(w)}v${f(h)}h${f(-w)}z`
    : `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${r} ${r} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${r} ${r} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}z`;
export const line = (...p: [number, number][]) => 'M' + p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L');

type Pt = [number, number];
const R = Math.PI / 180;
const go = (o: Pt, ang: number, len: number): Pt => [o[0] + Math.sin(ang * R) * len, o[1] + Math.cos(ang * R) * len];

/** stick figure: round head, line body, no face. Faces +x (flip with the stage's `flip`). */
export const person = (p: PictoParams = {}, ox = 0, k = 1): Seg[] => {
  const pose = p.pose ?? 'stand';
  const ph = p.phase ?? 0;
  const s = Math.sin(ph);
  // limb angles (deg from straight down, + = towards +x): [upper, lower]
  let armF: Pt = [12, 6], armB: Pt = [-12, -6], legF: Pt = [7, 5], legB: Pt = [-7, -5];
  let headDx = 0, lean = 0;
  if (pose === 'walk') {
    legF = [26 * s, 26 * s - 14 * Math.max(0, -s)];
    legB = [-26 * s, -26 * s - 14 * Math.max(0, s)];
    armF = [-22 * s, -22 * s + 14];
    armB = [22 * s, 22 * s + 14];
    lean = 3;
  } else if (pose === 'point') armF = [98, 92];
  else if (pose === 'phone') {
    armF = [18, 152];
    armB = [-8, 10];
    headDx = 2.5;
  } else if (pose === 'wave') armF = [150, 170];
  else if (pose === 'hold') armF = [30, 88];
  else if (pose === 'think') armF = [25, 168];
  else if (pose === 'sit') {
    legF = [82, 2];
    legB = [76, -2];
    armF = [20, 60];
  }
  const thigh = 23, shin = 22, torso = 37, up = 18, low = 17;
  // pose the figure from the hip, then drop it so the lowest foot touches y = 0
  const hip0: Pt = [0, 0];
  const kF = go(hip0, legF[0], thigh), fF = go(kF, legF[1], shin);
  const kB = go(hip0, legB[0], thigh), fB = go(kB, legB[1], shin);
  const dy = -Math.max(fF[1], fB[1]);
  const T = (q: Pt): [number, number] => [ox + q[0] * k, (q[1] + dy) * k];
  const neck: Pt = [lean, -torso];
  const sh: Pt = [lean * 0.85, -torso + 5];
  const head: Pt = [lean + headDx, -torso - 12];
  const eF = go(sh, armF[0], up), hF = go(eF, armF[1], low);
  const eB = go(sh, armB[0], up), hB = go(eB, armB[1], low);
  const L = (...q: Pt[]) => line(...q.map(T));
  const hr = 8.5 * k;
  const [hx, hy] = T(head);
  const segs: Seg[] = [
    {d: circle(hx, hy, hr)},
    {d: L(neck, hip0)},
    {d: L(hB, eB, sh)},
    {d: L(sh, eF, hF)},
    {d: L(fB, kB, hip0)},
    {d: L(hip0, kF, fF)},
  ];
  if (p.hair === 'long') segs.splice(1, 0, {d: `M${f(hx - 1 * k)} ${f(hy - hr)}C${f(hx - 12 * k)} ${f(hy - hr)} ${f(hx - 13 * k)} ${f(hy + 6 * k)} ${f(hx - 8 * k)} ${f(hy + 15 * k)}`});
  if (p.hair === 'bun') segs.splice(1, 0, {d: circle(hx - 7 * k, hy - 6 * k, 3.6 * k)});
  if (p.dress) segs.push({d: L([lean - 2.5, -16], [-12, 4], [12, 4], [lean + 2.5, -16])});
  if (p.vest) segs.push({d: L([sh[0] - 6, sh[1] + 3], [-7, -3], [7, -3], [sh[0] + 6, sh[1] + 3]), a: true});
  if (p.tie) segs.push({d: L([sh[0], sh[1]], [sh[0] - 2.5, sh[1] + 14], [sh[0], sh[1] + 18], [sh[0] + 2.5, sh[1] + 14], [sh[0], sh[1]]), a: true});
  if (pose === 'phone' || p.hold === 'phone') {
    const [px, py] = T([hF[0] + 2, hF[1] - 4]);
    segs.push({d: rect(px - 4.5 * k, py - 7.5 * k, 9 * k, 15 * k, 1.6 * k)}, {d: rect(px - 2.6 * k, py - 5.2 * k, 5.2 * k, 9.5 * k), a: true, fill: true, w: 0.4});
  } else if (p.hold && PICTOS[p.hold]) {
    const [px, py] = T(hF);
    const sub = PICTOS[p.hold]({}).map((g) => ({...g, d: shift(g.d, px, py, 0.32 * k)}));
    segs.push(...sub);
  }
  return segs;
};

/** translate + scale a path made by this library (absolute commands + relative a/h/v) */
export const shift = (d: string, dx: number, dy: number, sc = 1) => {
  // tokenise commands; absolute M/L/C/Q/H/V/A get translated, relative a/h/v/l only scaled
  const out: string[] = [];
  const re = /([MLCQSHVAZmlhvazqcs])([^MLCQSHVAZmlhvazqcs]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d))) {
    const c = m[1];
    const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    let r: number[] = n;
    if ('MLCQS'.includes(c)) r = n.map((v, i) => (i % 2 === 0 ? v * sc + dx : v * sc + dy));
    else if (c === 'H') r = n.map((v) => v * sc + dx);
    else if (c === 'V') r = n.map((v) => v * sc + dy);
    else if (c === 'A' || c === 'a')
      r = n.map((v, i) => {
        const j = i % 7;
        if (j === 0 || j === 1) return v * sc;
        if (j === 5) return c === 'A' ? v * sc + dx : v * sc;
        if (j === 6) return c === 'A' ? v * sc + dy : v * sc;
        return v;
      });
    else r = n.map((v) => v * sc);
    out.push(c + r.map(f).join(' '));
  }
  return out.join('');
};

const shop = (p: PictoParams): Seg[] => {
  const W = 86, H = 150;
  const sc: string[] = [];
  const n = 6, w = (2 * (W + 6)) / n;
  let d = `M${-W - 6} -94`;
  for (let i = 0; i < n; i++) d += `a${f(w / 2)} 8 0 0 0 ${f(w)} 0`;
  for (let i = 1; i < n; i++) sc.push(line([-W + (2 * W * i) / n, -114], [-W - 6 + w * i, -94]));
  const segs: Seg[] = [
    {d: line([-W, 0], [-W, -H], [W, -H], [W, 0])},
    {d: rect(-62, -142, 124, 22, 3)},
    {d: line([-W - 6, -94], [-W, -114], [W, -114], [W + 6, -94]), a: true},
    {d, a: true},
    ...sc.map((x) => ({d: x, a: true, w: 0.7})),
    {d: rect(-72, -76, 82, 56, 2)},
    {d: line([-31, -76], [-31, -20]), w: 0.6},
    {d: line([24, 0], [24, -80], [64, -80], [64, 0])},
    {d: circle(31, -40, 2), fill: true},
  ];
  if (p.pole) segs.push({d: rect(70, -78, 9, 42, 4.5)}, {d: line([70, -70], [79, -62]), w: 0.7}, {d: line([70, -58], [79, -50]), w: 0.7}, {d: line([70, -46], [79, -38]), w: 0.7});
  if (p.open) segs.push({d: line([36, -80], [44, -66], [52, -80]), w: 0.6}, {d: rect(30, -66, 28, 12, 2)});
  return segs;
};

export const PICTOS: Record<string, (p: PictoParams) => Seg[]> = {
  person: (p) => person(p),
  woman: (p) => person({hair: 'long', dress: true, ...p}),
  barber: (p) => person({hold: 'scissors', pose: 'hold', ...p}),
  crowd: (p) => {
    const n = p.n ?? 5;
    const out: Seg[] = [];
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 30, kk = i % 2 ? 0.86 : 0.94;
      out.push(...person({hair: i % 3 === 1 ? 'long' : undefined}, x, kk));
    }
    return out;
  },
  shop: (p) => shop(p),
  storefront: (p) => shop(p),
  barbershop: (p) => shop({pole: true, ...p}),
  barberChair: () => [
    {d: line([-22, -70], [-24, -40], [16, -40], [18, -46])},
    {d: line([-24, -40], [-24, -30], [20, -30])},
    {d: line([-2, -30], [-2, -6])},
    {d: line([-20, 0], [16, 0])},
    {d: line([16, -30], [26, -14], [34, -14])},
    {d: line([-26, -52], [14, -52]), w: 0.8},
  ],
  scissors: () => [
    {d: line([-6, 5], [26, -6])},
    {d: line([-6, -5], [26, 6])},
    {d: circle(-12, 7, 6)},
    {d: circle(-12, -7, 6)},
    {d: circle(6, 0, 1.4), fill: true},
  ],
  comb: () => [{d: rect(-22, -6, 44, 7, 2)}, ...Array.from({length: 9}, (_, i) => ({d: line([-18 + i * 4.5, 1], [-18 + i * 4.5, 10]), w: 0.6}))],
  cafeTable: () => [{d: line([-34, -46], [34, -46])}, {d: line([0, -46], [0, 0])}, {d: line([-16, 0], [16, 0])}],
  cup: () => [
    {d: line([-11, -24], [-8, 0], [8, 0], [11, -24], [-11, -24])},
    {d: `M11 -19a7 6 0 0 1 0 12`},
    {d: `M-4 -30q-4 -5 0 -10q4 -5 0 -10`, w: 0.7},
    {d: `M4 -30q-4 -5 0 -10q4 -5 0 -10`, w: 0.7},
  ],
  croissant: () => [
    {d: 'M-30 4Q-26 -26 0 -26Q26 -26 30 4Q20 -6 0 -8Q-20 -6 -30 4Z'},
    {d: line([-12, -24], [-8, -8]), w: 0.7},
    {d: line([0, -26], [0, -8]), w: 0.7},
    {d: line([12, -24], [8, -8]), w: 0.7},
  ],
  bread: () => [
    {d: 'M-34 0Q-38 -26 0 -28Q38 -26 34 0Z'},
    {d: line([-16, -10], [-8, -20]), w: 0.7},
    {d: line([-2, -10], [6, -21]), w: 0.7},
    {d: line([12, -10], [20, -19]), w: 0.7},
  ],
  oven: () => [{d: rect(-34, -64, 68, 64, 4)}, {d: rect(-24, -42, 48, 30, 3)}, {d: line([-30, -50], [30, -50])}, {d: circle(-18, -57, 3)}, {d: circle(-6, -57, 3)}, {d: line([-12, -10], [-12, -4]), w: 0.6}, {d: `M-14 -30q4 -6 8 0q4 6 8 0`, a: true}],
  wrench: () => [{d: line([-24, 24], [6, -6])}, {d: 'M6 -6a12 12 0 1 1 10 4l-8 -8l6 -10a12 12 0 0 0 -8 14'}],
  toolbox: () => [{d: rect(-38, -34, 76, 34, 3)}, {d: line([-38, -22], [38, -22])}, {d: line([-12, -34], [-12, -44], [12, -44], [12, -34])}, {d: rect(-5, -26, 10, 8, 1), a: true}],
  van: () => [
    {d: line([-74, -10], [-74, -64], [28, -64], [52, -36], [74, -32], [74, -10])},
    {d: line([-74, -10], [-62, -10])},
    {d: line([-34, -10], [36, -10])},
    {d: line([64, -10], [74, -10])},
    {d: circle(-48, -10, 12)},
    {d: circle(50, -10, 12)},
    {d: line([30, -58], [46, -38], [30, -38], [30, -58])},
    {d: line([-60, -44], [10, -44]), a: true},
  ],
  car: () => [
    {d: line([-62, -12], [-62, -30], [-40, -33], [-22, -54], [24, -54], [40, -33], [62, -28], [62, -12])},
    {d: line([-62, -12], [-50, -12])},
    {d: line([-22, -12], [26, -12])},
    {d: line([54, -12], [62, -12])},
    {d: circle(-36, -12, 12)},
    {d: circle(40, -12, 12)},
    {d: line([-16, -50], [0, -50], [0, -34], [-30, -34], [-16, -50]), w: 0.7},
    {d: line([6, -50], [20, -50], [32, -34], [6, -34], [6, -50]), w: 0.7},
  ],
  counter: () => [{d: line([-70, -56], [70, -56])}, {d: line([-62, -56], [-62, 0])}, {d: line([62, -56], [62, 0])}, {d: rect(18, -78, 28, 22, 2)}, {d: line([22, -84], [42, -84]), w: 0.6}],
  door: (p) => [{d: line([-24, 0], [-24, -96], [24, -96], [24, 0])}, {d: circle(14, -48, 2.4), fill: true}, ...(p.open ? [{d: rect(-14, -76, 28, 12, 2), a: true}] : [])],
  phone: (p) => {
    const segs: Seg[] = [{d: rect(-24, -46, 48, 92, 8)}, {d: line([-6, -40], [6, -40]), w: 0.7}];
    const scr = p.screen ?? 'blank';
    if (scr === 'lit') segs.push({d: rect(-18, -33, 36, 66, 2), a: true});
    else segs.push({d: rect(-18, -33, 36, 66, 2), w: 0.6});
    if (scr === 'grid') for (let i = 0; i < 9; i++) segs.push({d: rect(-15 + (i % 3) * 10.5, -16 + Math.floor(i / 3) * 10.5, 9, 9, 1), w: 0.5});
    if (scr === 'grid') segs.push({d: circle(-10, -25, 4), w: 0.6}, {d: line([-3, -27], [12, -27]), w: 0.5}, {d: line([-3, -22], [8, -22]), w: 0.5});
    if (scr === 'post') segs.push({d: rect(-14, -24, 28, 28, 1), w: 0.6}, {d: line([-14, 12], [10, 12]), w: 0.5}, {d: line([-14, 19], [4, 19]), w: 0.5}, {d: `M-8 -2l7 -9l6 6l4 -4l5 7`, a: true, w: 0.7});
    return segs;
  },
  feed: () => [{d: circle(-26, -36, 9)}, {d: line([-12, -40], [30, -40]), w: 0.7}, {d: line([-12, -32], [18, -32]), w: 0.7}, ...Array.from({length: 9}, (_, i) => ({d: rect(-36 + (i % 3) * 25, -18 + Math.floor(i / 3) * 25, 22, 22, 2), w: 0.7}))],
  calendar: () => [
    {d: rect(-34, -30, 68, 62, 5)},
    {d: line([-34, -14], [34, -14])},
    {d: line([-16, -36], [-16, -24])},
    {d: line([16, -36], [16, -24])},
    ...Array.from({length: 8}, (_, i) => ({d: rect(-24 + (i % 4) * 13, -6 + Math.floor(i / 4) * 14, 7, 7, 1), w: 0.6, a: i === 5})),
  ],
  clock: () => [
    {d: circle(0, 0, 32)},
    {d: line([0, 0], [0, -20])},
    {d: line([0, 0], [14, 0]), a: true},
    ...[0, 90, 180, 270].map((a) => ({d: line(go([0, 0], a, 25), go([0, 0], a, 29)), w: 0.6})),
  ],
  coin: () => [{d: circle(0, 0, 18)}, {d: circle(0, 0, 12), a: true, w: 0.7}, {d: `M4 -5a6 6 0 1 0 0 10`, w: 0.7}, {d: line([-6, -1.5], [3, -1.5]), w: 0.5}, {d: line([-6, 2], [3, 2]), w: 0.5}],
  coinStack: (p) => {
    const n = p.n ?? 4;
    const out: Seg[] = [];
    for (let i = 0; i < n; i++) out.push({d: ellipse(0, -6 - i * 9, 20, 6), a: i === n - 1}, {d: line([-20, -6 - i * 9], [-20, -i * 9 + 3]), w: 0.6}, {d: line([20, -6 - i * 9], [20, -i * 9 + 3]), w: 0.6});
    return out;
  },
  banknote: () => [{d: rect(-38, -20, 76, 40, 3)}, {d: circle(0, 0, 9), a: true}, {d: rect(-32, -14, 64, 28, 2), w: 0.5}],
  priceTag: () => [{d: line([-26, -14], [12, -14], [26, 0], [12, 14], [-26, 14], [-26, -14]), a: true}, {d: circle(-17, 0, 3.2)}],
  receipt: () => [
    {d: line([-20, -34], [20, -34], [20, 30], [15, 26], [10, 30], [5, 26], [0, 30], [-5, 26], [-10, 30], [-15, 26], [-20, 30], [-20, -34])},
    ...[-22, -14, -6, 2].map((y) => ({d: line([-12, y], [12, y]), w: 0.6})),
    {d: line([2, 14], [12, 14]), a: true},
  ],
  contract: () => [
    {d: rect(-26, -36, 52, 72, 2)},
    ...[-24, -16, -8, 0, 8].map((y, i) => ({d: line([-16, y], [i === 4 ? 4 : 16, y]), w: 0.6})),
    {d: `M-14 24c4 -8 6 6 10 -2s6 4 12 -2`, a: true},
  ],
  chart: (p) => {
    const n = p.n ?? 4;
    const out: Seg[] = [{d: line([-36, -36], [-36, 30], [40, 30])}];
    for (let i = 0; i < n; i++) out.push({d: rect(-28 + i * (60 / n), 30 - (12 + i * 12), 60 / n - 6, 12 + i * 12, 1), w: 0.7, a: i === n - 1});
    return out;
  },
  arrow: () => [{d: line([-34, 0], [34, 0])}, {d: line([20, -12], [34, 0], [20, 12])}],
  lightbulb: () => [
    {d: 'M-10 14C-10 4 -22 -2 -22 -16A22 22 0 1 1 22 -16C22 -2 10 4 10 14Z'},
    {d: line([-9, 20], [9, 20])},
    {d: line([-6, 26], [6, 26])},
    {d: 'M-6 6L-6 -8L0 -14L6 -8L6 6', a: true, w: 0.7},
  ],
  speechBubble: () => [{d: 'M-36 -30H36A6 6 0 0 1 42 -24V8A6 6 0 0 1 36 14H-6L-20 28L-18 14H-36A6 6 0 0 1 -42 8V-24A6 6 0 0 1 -36 -30Z'}, ...[-14, -4].map((y) => ({d: line([-26, y], [26, y]), w: 0.6}))],
  question: () => [{d: 'M-14 -16C-14 -38 16 -38 16 -18C16 -6 0 -6 0 8'}, {d: circle(0, 20, 2.6), fill: true}],
  check: () => [{d: line([-18, 0], [-5, 13], [20, -14])}],
  cross: () => [{d: line([-15, -15], [15, 15])}, {d: line([15, -15], [-15, 15])}],
  house: () => [{d: line([-44, 0], [-44, -50], [0, -84], [44, -50], [44, 0])}, {d: line([-10, 0], [-10, -30], [10, -30], [10, 0])}, {d: rect(18, -42, 16, 14, 1), w: 0.7, a: true}],
  office: () => [
    {d: line([-38, 0], [-38, -150], [38, -150], [38, 0])},
    ...Array.from({length: 12}, (_, i) => ({d: rect(-26 + (i % 3) * 20, -136 + Math.floor(i / 3) * 28, 12, 16, 1), w: 0.6, a: i === 4})),
    {d: line([-8, 0], [-8, -18], [8, -18], [8, 0])},
  ],
  globe: () => [{d: circle(0, 0, 34)}, {d: ellipse(0, 0, 14, 34), w: 0.7}, {d: line([-34, 0], [34, 0]), w: 0.7}, {d: 'M-30 -16Q0 -10 30 -16', w: 0.6}, {d: 'M-30 16Q0 10 30 16', w: 0.6}, {d: circle(14, -14, 3), a: true, fill: true}],
  planet: () => [{d: circle(0, 0, 26)}, {d: 'M-24 10C-60 26 -40 34 0 20C40 6 60 -16 24 -8', a: true}],
  rocket: () => [
    {d: 'M0 -48C14 -34 16 -10 12 16H-12C-16 -10 -14 -34 0 -48Z'},
    {d: circle(0, -14, 5)},
    {d: line([-12, 4], [-22, 22], [-12, 16])},
    {d: line([12, 4], [22, 22], [12, 16])},
    {d: 'M-6 20Q0 40 6 20', a: true},
  ],
  sign: () => [{d: line([-26, -18], [0, -34], [26, -18])}, {d: rect(-34, -18, 68, 30, 3)}],
};

export const pictoSegs = (kind: string, p: PictoParams = {}): Seg[] => {
  const fn = PICTOS[kind];
  if (!fn) throw new Error('unknown pictogram ' + kind);
  return fn(p);
};
