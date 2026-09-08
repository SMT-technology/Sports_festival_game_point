"use client";

import { classLabel } from "@/lib/scoring";
import type { ClassRow } from "@/lib/database.types";

const MEDAL = ["🥇", "🥈", "🥉"];

export function CheerAwardsBoard({
  classesByGrade,
  cheerTotals,
}: {
  classesByGrade: Map<number, ClassRow[]>;
  cheerTotals: Map<string, number>;
}) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-5">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-amber-700">
        🎗️ 학년별 응원상
      </h2>
      <p className="mt-1 text-xs text-amber-600/80">
        응원·질서 점수는 종합 순위와 별도로 집계됩니다.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...classesByGrade.keys()].sort().map((grade) => {
          const ranked = [...classesByGrade.get(grade)!].sort(
            (a, b) => (cheerTotals.get(b.id) ?? 0) - (cheerTotals.get(a.id) ?? 0),
          );
          return (
            <div key={grade} className="rounded-lg bg-white p-3 shadow-sm">
              <p className="mb-2 text-sm font-bold text-slate-700">{grade}학년</p>
              <div className="space-y-1">
                {ranked.slice(0, 5).map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between text-xs">
                    <span>
                      {MEDAL[i] ?? `${i + 1}위`} {classLabel(c)}
                    </span>
                    <b className="text-amber-600">{cheerTotals.get(c.id) ?? 0}점</b>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
