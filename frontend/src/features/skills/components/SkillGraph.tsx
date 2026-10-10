import type { SkillMap, SkillNode } from "@/api/types";
import { tr } from "@/i18n/copy";
import {
  type KeyboardEvent,
  type PointerEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { HEIGHT, type Point, WIDTH, layout, radius } from "../layout";
import { STATUS_FILL, latestScore } from "../status";

/**
 * Obsidian-style map: circles are skills, lines join skills that the same saved
 * vacancy asks for. Selecting a skill dims everything it is not connected to.
 * Circles can be dragged to untangle the picture.
 */
export function SkillGraph({
  data,
  selected,
  onSelect,
}: {
  data: SkillMap;
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const keys = useMemo(() => data.nodes.map((n) => n.key), [data.nodes]);
  const initial = useMemo(() => layout(keys, data.links), [keys, data.links]);
  const [moved, setMoved] = useState<Record<string, Point>>({});
  const [hover, setHover] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  // A drag that moved the circle should not also toggle the selection.
  const dragged = useRef(false);
  const position = (key: string) => moved[key] ?? initial[key];

  const focus = hover ?? selected;
  const neighbours = useMemo(() => {
    const result = new Set<string>();
    if (!focus) return result;
    result.add(focus);
    for (const link of data.links) {
      if (link.source === focus) result.add(link.target);
      if (link.target === focus) result.add(link.source);
    }
    return result;
  }, [focus, data.links]);
  const dimmed = (key: string) => focus !== null && !neighbours.has(key);

  const toCanvas = (event: PointerEvent): Point | null => {
    const matrix = svg.current?.getScreenCTM();
    if (!svg.current || !matrix) return null;
    const point = svg.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const p = point.matrixTransform(matrix.inverse());
    return {
      x: Math.min(WIDTH - 12, Math.max(12, p.x)),
      y: Math.min(HEIGHT - 12, Math.max(12, p.y)),
    };
  };

  const describeNode = (node: SkillNode) =>
    [
      node.name,
      tr(`skillMap.status.${node.status}`),
      tr("skillMap.askedIn", { count: node.demand }),
      latestScore(node) !== null
        ? tr("skillMap.practiceScore", { score: latestScore(node) })
        : "",
    ]
      .filter(Boolean)
      .join(". ");

  const keyDown = (event: KeyboardEvent, key: string) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(selected === key ? null : key);
    }
  };

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full h-auto touch-none select-none rounded-xl border bg-background"
      role="group"
      aria-label={tr("skillMap.mapLabel")}
      onPointerMove={(event) => {
        if (!dragging) return;
        const p = toCanvas(event);
        const from = position(dragging);
        // Ignore jitter so a tap still selects the skill.
        if (
          !p ||
          (!dragged.current && Math.hypot(p.x - from.x, p.y - from.y) < 4)
        )
          return;
        dragged.current = true;
        setMoved((current) => ({ ...current, [dragging]: p }));
      }}
      onPointerUp={() => setDragging(null)}
      onPointerLeave={() => setDragging(null)}
      onClick={(event) => {
        if (event.target === svg.current) onSelect(null);
      }}
    >
      <g aria-hidden="true">
        {data.links.map((link) => {
          const a = position(link.source);
          const b = position(link.target);
          if (!a || !b) return null;
          const active =
            focus !== null && (link.source === focus || link.target === focus);
          return (
            <line
              key={`${link.source}-${link.target}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={active ? "stroke-primary" : "stroke-muted-foreground"}
              strokeOpacity={active ? 0.8 : focus ? 0.08 : 0.25}
              strokeWidth={Math.min(1 + link.weight, 4)}
            />
          );
        })}
      </g>
      {data.nodes.map((node) => {
        const p = position(node.key);
        if (!p) return null;
        const r = radius(node.demand);
        const score = latestScore(node);
        const ring = 2 * Math.PI * (r + 4);
        return (
          <g
            key={node.key}
            role="button"
            tabIndex={0}
            aria-pressed={selected === node.key}
            aria-label={describeNode(node)}
            transform={`translate(${p.x} ${p.y})`}
            className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-ring"
            opacity={dimmed(node.key) ? 0.2 : 1}
            onPointerEnter={() => setHover(node.key)}
            onPointerLeave={() => setHover(null)}
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture?.(event.pointerId);
              dragged.current = false;
              setDragging(node.key);
            }}
            onClick={() => {
              if (!dragged.current)
                onSelect(selected === node.key ? null : node.key);
              dragged.current = false;
            }}
            onKeyDown={(event) => keyDown(event, node.key)}
          >
            <circle
              r={r}
              className={STATUS_FILL[node.status]}
              stroke="currentColor"
              strokeWidth={selected === node.key ? 3 : 0}
            />
            {score !== null && (
              <circle
                r={r + 4}
                fill="none"
                className="stroke-primary"
                strokeWidth={2.5}
                strokeDasharray={`${(ring * score) / 100} ${ring}`}
                transform="rotate(-90)"
              />
            )}
            <text
              y={r + 16}
              textAnchor="middle"
              className="fill-foreground text-[13px] font-medium"
            >
              {node.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
