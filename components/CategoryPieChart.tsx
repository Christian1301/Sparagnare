"use client";

import { useMemo, useState } from "react";

const INK = "#1B2A3A";
const MUTED = "#8A8474";
const PAPER = "#FAF8F2";

const SIZE = 168;
const CENTER = SIZE / 2;
const R_OUTER = 78;
const R_INNER = 48;

function formatEUR(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}

function polarToCartesian(angle: number, r: number) {
  return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) };
}

function donutSlicePath(startAngle: number, endAngle: number, rOuter: number, rInner: number) {
  const startOuter = polarToCartesian(startAngle, rOuter);
  const endOuter = polarToCartesian(endAngle, rOuter);
  const startInner = polarToCartesian(endAngle, rInner);
  const endInner = polarToCartesian(startAngle, rInner);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${startOuter.x.toFixed(2)} ${startOuter.y.toFixed(2)}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${endOuter.x.toFixed(2)} ${endOuter.y.toFixed(2)}`,
    `L ${startInner.x.toFixed(2)} ${startInner.y.toFixed(2)}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${endInner.x.toFixed(2)} ${endInner.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export default function CategoryPieChart({ expenses, categories }: { expenses: any[]; categories: any[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const slices = useMemo(() => {
    const byCategory = new Map<string, number>();
    for (const t of expenses) {
      const key = t.category_id || "__none__";
      byCategory.set(key, (byCategory.get(key) || 0) + Number(t.amount));
    }
    const rows = Array.from(byCategory.entries()).map(([categoryId, amount]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        id: categoryId,
        name: cat?.name || "Altro",
        color: cat?.color || "#999999",
        amount,
      };
    });
    rows.sort((a, b) => b.amount - a.amount);
    return rows;
  }, [expenses, categories]);

  const total = slices.reduce((s, x) => s + x.amount, 0);

  const arcs = useMemo(() => {
    let angle = -Math.PI / 2;
    return slices.map((s) => {
      const fraction = total > 0 ? s.amount / total : 0;
      const startAngle = angle;
      const endAngle = angle + fraction * Math.PI * 2;
      angle = endAngle;
      return { ...s, startAngle, endAngle, fraction };
    });
  }, [slices, total]);

  const active = activeIdx !== null ? arcs[activeIdx] : null;

  if (total <= 0) {
    return (
      <div>
        <div className="text-sm font-semibold text-muted mb-2">Spese per categoria</div>
        <div className="text-sm text-muted pb-2">Nessuna uscita questo mese.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="text-sm font-semibold text-muted mb-2">Spese per categoria</div>
      <div className="flex items-center gap-4">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
          height={SIZE}
          role="img"
          aria-label="Spese del mese divise per categoria"
          className="shrink-0"
          onMouseLeave={() => setActiveIdx(null)}
        >
          {arcs.length === 1 ? (
            <>
              <circle cx={CENTER} cy={CENTER} r={(R_OUTER + R_INNER) / 2} fill="none" stroke={arcs[0].color} strokeWidth={R_OUTER - R_INNER}
                opacity={activeIdx === null || activeIdx === 0 ? 1 : 0.35}
                onMouseEnter={() => setActiveIdx(0)}
                onTouchStart={() => setActiveIdx(0)}
              />
            </>
          ) : (
            arcs.map((a, i) => (
              <path
                key={a.id}
                d={donutSlicePath(a.startAngle, a.endAngle, R_OUTER, R_INNER)}
                fill={a.color}
                stroke={PAPER}
                strokeWidth={2}
                opacity={activeIdx === null || activeIdx === i ? 1 : 0.35}
                onMouseEnter={() => setActiveIdx(i)}
                onTouchStart={() => setActiveIdx(i)}
              />
            ))
          )}

          <text x={CENTER} y={CENTER - 6} textAnchor="middle" fontSize={9} fill={MUTED}>
            {active ? active.name : "Totale uscite"}
          </text>
          <text x={CENTER} y={CENTER + 12} textAnchor="middle" fontSize={13} fontWeight={700} fill={INK}>
            {formatEUR(active ? active.amount : total)}
          </text>
          {active && (
            <text x={CENTER} y={CENTER + 26} textAnchor="middle" fontSize={9} fill={MUTED}>
              {Math.round(active.fraction * 100)}%
            </text>
          )}
        </svg>

        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          {arcs.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => setActiveIdx(activeIdx === i ? null : i)}
              className="flex items-center gap-2 text-left"
              style={{ opacity: activeIdx === null || activeIdx === i ? 1 : 0.5 }}
            >
              <span aria-hidden className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: a.color }} />
              <span className="text-xs text-ink truncate flex-1">{a.name}</span>
              <span className="text-xs text-muted shrink-0">{Math.round(a.fraction * 100)}%</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
