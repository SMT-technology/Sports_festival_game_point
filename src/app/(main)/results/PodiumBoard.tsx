"use client";

import { classLabel } from "@/lib/scoring";
import type { ClassRow } from "@/lib/database.types";
import type { ClassComputed } from "./types";

const PODIUM_STYLE = [
  {
    medal: "🥇",
    label: "1위",
    height: "min-h-[220px]",
    bg: "bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500",
    ring: "ring-amber-200",
  },
  {
    medal: "🥈",
    label: "2위",
    height: "min-h-[170px]",
    bg: "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400",
    ring: "ring-slate-200",
  },
  {
    medal: "🥉",
    label: "3위",
    height: "min-h-[140px]",
    bg: "bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500",
    ring: "ring-orange-200",
  },
];

function rankFor(list: ClassRow[], classComputed: ClassComputed, classId: string) {
  const totals = list.map((c) => classComputed.get(c.id)?.total ?? 0);
  const idx = list.findIndex((c) => c.id === classId);
  const myTotal = totals[idx];
  return totals.filter((t) => t > myTotal).length + 1;
}

function PodiumSlot({
  c,
  total,
  style,
}: {
  c: ClassRow | undefined;
  total: number;
  style: (typeof PODIUM_STYLE)[number];
}) {
  if (!c) return <div className="w-32" />;
  return (
    <div
      className={`flex w-32 flex-col items-center justify-end rounded-2xl ${style.bg} ${style.height} p-3 text-center text-white shadow-lg ring-4 ${style.ring} sm:w-40`}
    >
      <span className="text-4xl drop-shadow">{style.medal}</span>
      <p className="mt-1 text-sm font-bold drop-shadow">{classLabel(c)}</p>
      <p className="text-2xl font-extrabold drop-shadow">{total}</p>
      <p className="text-xs font-semibold opacity-90">{style.label}</p>
    </div>
  );
}

export function PodiumBoard({
  classesByGrade,
  classComputed,
}: {
  classesByGrade: Map<number, ClassRow[]>;
  classComputed: ClassComputed;
}) {
  return (
    <div className="space-y-12">
      {[...classesByGrade.keys()].sort().map((grade) => {
        const list = classesByGrade.get(grade)!;
        const [first, second, third] = list;
        const rest = list.slice(3);

        return (
          <div key={grade}>
            <h2 className="mb-4 text-center text-xl font-extrabold text-slate-900">
              🏆 {grade}학년 순위 🏆
            </h2>

            <div className="flex items-end justify-center gap-3 sm:gap-4">
              <PodiumSlot
                c={second}
                total={classComputed.get(second?.id ?? "")?.total ?? 0}
                style={PODIUM_STYLE[1]}
              />
              <PodiumSlot
                c={first}
                total={classComputed.get(first?.id ?? "")?.total ?? 0}
                style={PODIUM_STYLE[0]}
              />
              <PodiumSlot
                c={third}
                total={classComputed.get(third?.id ?? "")?.total ?? 0}
                style={PODIUM_STYLE[2]}
              />
            </div>

            {rest.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {rest.map((c) => {
                  const rank = rankFor(list, classComputed, c.id);
                  const total = classComputed.get(c.id)?.total ?? 0;
                  return (
                    <span
                      key={c.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm"
                    >
                      {rank}위 · {classLabel(c)} ·{" "}
                      <b className="text-slate-800">{total}점</b>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
