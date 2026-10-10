export type Point = { x: number; y: number };
export type Edge = { source: string; target: string; weight: number };

export type Canvas = { width: number; height: number };
/** Landscape canvas for wide screens, portrait for phones so labels stay readable. */
export const WIDE: Canvas = { width: 800, height: 520 };
export const TALL: Canvas = { width: 420, height: 580 };
const MARGIN = 48;

/**
 * A small deterministic force layout: nodes repel each other, skills asked for
 * together attract, and everything is pulled gently to the centre. The same
 * input always gives the same picture, so the map does not jump between visits.
 */
export function layout(
  keys: string[],
  edges: Edge[],
  canvas: Canvas = WIDE,
  iterations = 300,
): Record<string, Point> {
  const { width: WIDTH, height: HEIGHT } = canvas;
  const n = keys.length;
  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;
  const index = new Map(keys.map((k, i) => [k, i]));
  // Golden-angle spiral: the most important skills (first) start near the centre.
  const pos = keys.map((_, i) => ({
    x: cx + 28 * Math.sqrt(i) * Math.cos(i * 2.399963),
    y: cy + 28 * Math.sqrt(i) * Math.sin(i * 2.399963),
  }));
  const k =
    Math.sqrt(((WIDTH - 2 * MARGIN) * (HEIGHT - 2 * MARGIN)) / Math.max(n, 1)) *
    0.6;
  const springs = edges
    .map((e) => [
      index.get(e.source),
      index.get(e.target),
      Math.min(e.weight, 3),
    ])
    .filter(
      (e): e is [number, number, number] =>
        e[0] !== undefined && e[1] !== undefined,
    );
  for (let step = 0; step < iterations; step++) {
    const heat = (WIDTH / 10) * (1 - step / iterations) + 0.5;
    const move = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = pos[i].x - pos[j].x;
        let dy = pos[i].y - pos[j].y;
        if (dx === 0 && dy === 0) {
          dx = 0.01 * (i + 1);
          dy = 0.01 * (j + 1);
        }
        const d2 = dx * dx + dy * dy;
        const force = (k * k) / d2;
        move[i].x += dx * force;
        move[i].y += dy * force;
        move[j].x -= dx * force;
        move[j].y -= dy * force;
      }
    }
    for (const [a, b, weight] of springs) {
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      // Attraction grows with distance (d² / k) along the unit vector (dx / d).
      const pull = (Math.sqrt(dx * dx + dy * dy) / k) * weight;
      move[a].x -= dx * pull;
      move[a].y -= dy * pull;
      move[b].x += dx * pull;
      move[b].y += dy * pull;
    }
    for (let i = 0; i < n; i++) {
      // Gravity grows with distance (0.1 · d² / k) so unconnected skills stay in view.
      const toCentre = Math.hypot(cx - pos[i].x, cy - pos[i].y) / k;
      move[i].x += (cx - pos[i].x) * toCentre * 0.1;
      move[i].y += (cy - pos[i].y) * toCentre * 0.1;
      const length = Math.sqrt(move[i].x ** 2 + move[i].y ** 2) || 1;
      const limited = Math.min(length, heat);
      pos[i].x += (move[i].x / length) * limited;
      pos[i].y += (move[i].y / length) * limited;
    }
  }
  return fit(keys, pos, canvas);
}

/**
 * Turn the picture so its long side runs along the long side of the canvas, then scale it
 * to fill the canvas without distorting distances.
 */
function fit(
  keys: string[],
  pos: Point[],
  { width: WIDTH, height: HEIGHT }: Canvas,
): Record<string, Point> {
  const n = pos.length;
  if (n < 2)
    return Object.fromEntries(
      keys.map((key) => [key, { x: WIDTH / 2, y: HEIGHT / 2 }]),
    );
  const mx = pos.reduce((sum, p) => sum + p.x, 0) / n;
  const my = pos.reduce((sum, p) => sum + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pos) {
    sxx += (p.x - mx) ** 2;
    syy += (p.y - my) ** 2;
    sxy += (p.x - mx) * (p.y - my);
  }
  const angle =
    0.5 * Math.atan2(2 * sxy, sxx - syy) - (HEIGHT > WIDTH ? Math.PI / 2 : 0);
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  const turned = pos.map((p) => ({
    x: (p.x - mx) * cos - (p.y - my) * sin,
    y: (p.x - mx) * sin + (p.y - my) * cos,
  }));
  const xs = turned.map((p) => p.x);
  const ys = turned.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const scale = Math.min(
    (WIDTH - 2 * MARGIN) / (maxX - minX || 1),
    (HEIGHT - 2 * MARGIN) / (maxY - minY || 1),
    // Do not blow a small, tight group up to the whole canvas.
    1.6,
  );
  return Object.fromEntries(
    keys.map((key, i) => [
      key,
      {
        x: WIDTH / 2 + (xs[i] - (minX + maxX) / 2) * scale,
        y: HEIGHT / 2 + (ys[i] - (minY + maxY) / 2) * scale,
      },
    ]),
  );
}

/** Circle radius: skills asked for more often are bigger. */
export function radius(demand: number) {
  return Math.min(28, 11 + 5 * Math.sqrt(demand));
}
