"use client";

import { useState } from "react";
import dayjs from "dayjs";

interface TrendPoint {
  score: number;
  label: string; // e.g. role
  date: string; // ISO
}

interface ScoreTrendChartProps {
  points: TrendPoint[];
}

const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

/**
 * Single-series score trend (0–100). 2px accent line, 8px markers,
 * recessive hairline grid, crosshair + tooltip on hover.
 */
const ScoreTrendChart = ({ points }: ScoreTrendChartProps) => {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) return null;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const x = (index: number) =>
    PAD.left +
    (points.length === 1 ? innerW / 2 : (index / (points.length - 1)) * innerW);
  const y = (score: number) => PAD.top + innerH - (score / 100) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`)
    .join(" ");

  const gridLines = [0, 25, 50, 75, 100];
  const hovered = hover !== null ? points[hover] : null;

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[480px]"
        role="img"
        aria-label={`Score trend across ${points.length} sessions, latest score ${points[points.length - 1].score} out of 100`}
        onMouseLeave={() => setHover(null)}
      >
        {/* Recessive grid + axis labels (text tokens, not series color) */}
        {gridLines.map((value) => (
          <g key={value}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(value)}
              y2={y(value)}
              stroke="var(--hairline)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 8}
              y={y(value) + 3.5}
              textAnchor="end"
              fontSize={11}
              fill="var(--tx-faint)"
            >
              {value}
            </text>
          </g>
        ))}

        {/* Area fill under the line, very subtle */}
        <path
          d={`${path} L ${x(points.length - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`}
          fill="#ed5b23"
          opacity={0.07}
        />

        {/* Series line — 2px */}
        <path
          d={path}
          fill="none"
          stroke="#ed5b23"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Crosshair */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--hairline-strong)"
            strokeWidth={1}
          />
        )}

        {/* Markers — 8px, surface ring */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(p.score)}
            r={hover === i ? 5 : 4}
            fill="#ed5b23"
            stroke="var(--surface)"
            strokeWidth={2}
          />
        ))}

        {/* First/last date labels */}
        <text
          x={x(0)}
          y={H - 8}
          textAnchor="start"
          fontSize={11}
          fill="var(--tx-faint)"
        >
          {dayjs(points[0].date).format("MMM D")}
        </text>
        {points.length > 1 && (
          <text
            x={x(points.length - 1)}
            y={H - 8}
            textAnchor="end"
            fontSize={11}
            fill="var(--tx-faint)"
          >
            {dayjs(points[points.length - 1].date).format("MMM D")}
          </text>
        )}

        {/* Hover hit targets — wider than the marks */}
        {points.map((_, i) => (
          <rect
            key={`hit-${i}`}
            x={x(i) - innerW / Math.max(points.length - 1, 1) / 2}
            y={PAD.top}
            width={innerW / Math.max(points.length - 1, 1)}
            height={innerH}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {hovered && hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-hairline bg-surface-overlay px-3 py-2 shadow-lg"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            top: `${(y(hovered.score) / H) * 100}%`,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <p className="whitespace-nowrap text-xs font-medium capitalize text-strong">
            {hovered.label}
          </p>
          <p className="whitespace-nowrap text-xs text-faint">
            {dayjs(hovered.date).format("MMM D, YYYY")} ·{" "}
            <span className="font-semibold text-strong">{hovered.score}</span>
            /100
          </p>
        </div>
      )}
    </div>
  );
};

export default ScoreTrendChart;
