"use client";

import { useMemo, useRef, useState } from "react";
import { occursInMonth } from "@/lib/finance";

const MONTHS_SHORT = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

const INK = "#1B2A3A";
const TEAL = "#2F6F62";
const RUST = "#B5473D";
const LINE = "#EFEBE0";
const MUTED = "#8A8474";
const PAPER = "#FAF8F2";

const W = 343;
const H = 168;
const PAD_L = 34;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 22;

function compactEUR(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1000) return `${(n / 1000).toFixed(abs >= 10000 ? 0 : 1).replace(".", ",")}k €`;
  return `${Math.round(n)} €`;
}

function formatEUR(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n || 0);
}

export default function MonthlyTrendChart({
  transactions,
  cursor,
  monthsBack = 6,
}: {
  transactions: any[];
  cursor: { year: number; month: number };
  monthsBack?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const months = useMemo(() => {
    const arr: { year: number; month: number }[] = [];
    let y = cursor.year;
    let m = cursor.month - (monthsBack - 1);
    while (m < 0) {
      m += 12;
      y -= 1;
    }
    for (let i = 0; i < monthsBack; i++) {
      arr.push({ year: y, month: m });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
    return arr;
  }, [cursor.year, cursor.month, monthsBack]);

  const data = useMemo(() => {
    return months.map(({ year, month }) => {
      let income = 0;
      let expenses = 0;
      for (const t of transactions) {
        if (!occursInMonth(t, { year, month })) continue;
        if (t.type === "income") income += Number(t.amount);
        else expenses += Number(t.amount);
      }
      return { year, month, income, expenses };
    });
  }, [months, transactions]);

  const hasAnyData = data.some((d) => d.income > 0 || d.expenses > 0);

  const maxVal = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)));
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const niceMax = Math.ceil(maxVal / magnitude) * magnitude || maxVal;

  const xFor = (i: number) => PAD_L + (i * (W - PAD_L - PAD_R)) / Math.max(1, data.length - 1);
  const yFor = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / niceMax);

  function pathFor(key: "income" | "expenses") {
    return data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(d[key]).toFixed(1)}`).join(" ");
  }

  function handlePointer(clientX: number) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0) return;
    const relX = ((clientX - rect.left) / rect.width) * W;
    let nearest = 0;
    let best = Infinity;
    data.forEach((_, i) => {
      const dist = Math.abs(xFor(i) - relX);
      if (dist < best) {
        best = dist;
        nearest = i;
      }
    });
    setHoverIdx(nearest);
  }

  const gridSteps = [0, 0.5, 1];
  const hovered = hoverIdx !== null ? data[hoverIdx] : null;
  const last = data[data.length - 1];
  const bandWidth = (W - PAD_L - PAD_R) / Math.max(1, data.length - 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold text-muted">Andamento ultimi {monthsBack} mesi</div>
        {hasAnyData && (
          <button onClick={() => setShowTable((s) => !s)} className="text-xs text-muted underline">
            {showTable ? "Vedi grafico" : "Vedi tabella"}
          </button>
        )}
      </div>

      {!hasAnyData ? (
        <div className="text-sm text-muted pb-2">Non ci sono ancora dati sufficienti per uno storico.</div>
      ) : !showTable ? (
        <div>
          <div className="flex items-center gap-4 mb-1.5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-3 h-0.5 rounded-full" style={{ background: TEAL }} />
              Entrate
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="inline-block w-3 h-0.5 rounded-full" style={{ background: RUST }} />
              Uscite
            </span>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            role="img"
            aria-label={`Andamento di entrate e uscite negli ultimi ${monthsBack} mesi`}
            onMouseMove={(e) => handlePointer(e.clientX)}
            onMouseLeave={() => setHoverIdx(null)}
            onTouchStart={(e) => handlePointer(e.touches[0].clientX)}
            onTouchMove={(e) => handlePointer(e.touches[0].clientX)}
            onTouchEnd={() => setHoverIdx(null)}
          >
            {gridSteps.map((g) => {
              const y = PAD_T + (H - PAD_T - PAD_B) * (1 - g);
              return (
                <g key={g}>
                  <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke={LINE} strokeWidth={1} />
                  <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize={9} fill={MUTED}>
                    {compactEUR(niceMax * g)}
                  </text>
                </g>
              );
            })}

            {data.map((d, i) => (
              <text key={i} x={xFor(i)} y={H - 6} textAnchor="middle" fontSize={9} fill={MUTED}>
                {MONTHS_SHORT[d.month]}
              </text>
            ))}

            {hoverIdx !== null && (
              <line
                x1={xFor(hoverIdx)}
                x2={xFor(hoverIdx)}
                y1={PAD_T}
                y2={H - PAD_B}
                stroke={INK}
                strokeOpacity={0.15}
                strokeWidth={1}
              />
            )}

            <path d={pathFor("income")} fill="none" stroke={TEAL} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathFor("expenses")} fill="none" stroke={RUST} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

            {data.map((d, i) => (
              <g key={`m-${i}`}>
                <circle cx={xFor(i)} cy={yFor(d.income)} r={4} fill={TEAL} stroke={PAPER} strokeWidth={2} />
                <circle cx={xFor(i)} cy={yFor(d.expenses)} r={4} fill={RUST} stroke={PAPER} strokeWidth={2} />
              </g>
            ))}

            <text x={xFor(data.length - 1)} y={Math.max(PAD_T + 8, yFor(last.income) - 8)} textAnchor="end" fontSize={9} fontWeight={600} fill={INK}>
              {compactEUR(last.income)}
            </text>
            <text x={xFor(data.length - 1)} y={Math.min(H - PAD_B - 4, yFor(last.expenses) + 14)} textAnchor="end" fontSize={9} fontWeight={600} fill={INK}>
              {compactEUR(last.expenses)}
            </text>

            {data.map((_, i) => (
              <rect
                key={`hit-${i}`}
                x={Math.max(0, xFor(i) - bandWidth / 2)}
                y={0}
                width={bandWidth}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            ))}
          </svg>

          {hovered && (
            <div className="mt-2 text-xs bg-white border border-line rounded-lg px-3 py-2 flex flex-col gap-1">
              <div className="font-semibold text-ink">
                {MONTHS_SHORT[hovered.month]} {hovered.year}
              </div>
              <div className="flex justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span aria-hidden className="inline-block w-2.5 h-0.5 rounded-full" style={{ background: TEAL }} />
                  Entrate
                </span>
                <span className="font-semibold text-ink">{formatEUR(hovered.income)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="flex items-center gap-1.5 text-muted">
                  <span aria-hidden className="inline-block w-2.5 h-0.5 rounded-full" style={{ background: RUST }} />
                  Uscite
                </span>
                <span className="font-semibold text-ink">{formatEUR(hovered.expenses)}</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted border-b border-line">
                <th className="py-1.5 font-medium">Mese</th>
                <th className="py-1.5 font-medium text-right">Entrate</th>
                <th className="py-1.5 font-medium text-right">Uscite</th>
                <th className="py-1.5 font-medium text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="py-1.5">
                    {MONTHS_SHORT[d.month]} {d.year}
                  </td>
                  <td className="py-1.5 text-right text-teal">{formatEUR(d.income)}</td>
                  <td className="py-1.5 text-right text-rust">{formatEUR(d.expenses)}</td>
                  <td className={`py-1.5 text-right font-semibold ${d.income - d.expenses >= 0 ? "text-ink" : "text-rust"}`}>
                    {formatEUR(d.income - d.expenses)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
