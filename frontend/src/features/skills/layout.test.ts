import { describe, expect, it } from "vitest";
import { TALL, WIDE, layout, radius } from "./layout";

const { width: WIDTH, height: HEIGHT } = WIDE;

const keys = ["python", "docker", "go", "sql", "git", "kotlin"];
const edges = [
  { source: "python", target: "sql", weight: 3 },
  { source: "docker", target: "go", weight: 2 },
];

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

describe("layout", () => {
  it("is deterministic and stays inside the canvas", () => {
    const first = layout(keys, edges);
    expect(layout(keys, edges)).toEqual(first);
    for (const p of Object.values(first)) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(WIDTH);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(HEIGHT);
    }
  });

  it("puts skills asked for together closer than unrelated ones", () => {
    const p = layout(keys, edges);
    const linked = distance(p.python, p.sql);
    const others = keys
      .filter((k) => k !== "python" && k !== "sql")
      .map((k) => distance(p.python, p[k]));
    expect(linked).toBeLessThan(Math.min(...others));
    // No two skills sit on top of each other.
    for (const a of keys)
      for (const b of keys)
        if (a < b) expect(distance(p[a], p[b])).toBeGreaterThan(20);
  });

  it("lays the long side along a portrait canvas on phones", () => {
    const chain = ["a", "b", "c", "d", "e"];
    const links = chain
      .slice(1)
      .map((k, i) => ({ source: chain[i], target: k, weight: 1 }));
    const spread = (
      p: Record<string, { x: number; y: number }>,
      axis: "x" | "y",
    ) =>
      Math.max(...chain.map((k) => p[k][axis])) -
      Math.min(...chain.map((k) => p[k][axis]));
    const wide = layout(chain, links);
    const tall = layout(chain, links, TALL);
    expect(spread(wide, "x")).toBeGreaterThan(spread(wide, "y"));
    expect(spread(tall, "y")).toBeGreaterThan(spread(tall, "x"));
    for (const p of Object.values(tall)) {
      expect(p.x).toBeLessThan(TALL.width);
      expect(p.y).toBeLessThan(TALL.height);
    }
  });

  it("handles empty and single maps", () => {
    expect(layout([], [])).toEqual({});
    expect(layout(["solo"], []).solo).toEqual({ x: WIDTH / 2, y: HEIGHT / 2 });
    expect(radius(0)).toBeLessThan(radius(4));
    expect(radius(400)).toBe(28);
  });
});
