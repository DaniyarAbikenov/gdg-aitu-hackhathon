export type Point = { x: number; y: number };
export type Edge = { source: string; target: string; weight: number };

export const WIDTH = 800;
export const HEIGHT = 520;
const MARGIN = 48;

/**
 * A small deterministic force layout: nodes repel each other, skills asked for
 * together attract, and everything is pulled gently to the centre. The same
 * input always gives the same picture, so the map does not jump between visits.
 */
export function layout(
  keys: string[],
  edges: Edge[],
  iterations = 300,
): Record<string, Point> {
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
      move[i].x += (cx - pos[i].x) * 0.05;
      move[i].y += (cy - pos[i].y) * 0.08;
      const length = Math.sqrt(move[i].x ** 2 + move[i].y ** 2) || 1;
      const limited = Math.min(length, heat);
      pos[i].x = clamp(
        pos[i].x + (move[i].x / length) * limited,
        MARGIN,
        WIDTH - MARGIN,
      );
      pos[i].y = clamp(
        pos[i].y + (move[i].y / length) * limited,
        MARGIN,
        HEIGHT - MARGIN,
      );
    }
  }
  return Object.fromEntries(keys.map((key, i) => [key, pos[i]]));
}

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

/** Circle radius: skills asked for more often are bigger. */
export function radius(demand: number) {
  return Math.min(26, 9 + 5 * Math.sqrt(demand));
}
