"use client";

import { Fragment, useState } from "react";
import { classLabel } from "@/lib/scoring";
import type { ClassRow } from "@/lib/database.types";
import type { ClassComputed } from "./types";

const MEDAL = ["🥇", "🥈", "🥉"];

export function DetailedTable({
  classesByGrade,
  classComputed,
}: {
  classesByGrade: Map<number, ClassRow[]>;
  classComputed: ClassComputed;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(classId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  }

  function rankFor(list: ClassRow[], classId: string) {
    const totals = list.map((c) => classComputed.get(c.id)?.total ?? 0);
    const idx = list.findIndex((c) => c.id === classId);
    const myTotal = totals[idx];
    return totals.filter((t) => t > myTotal).length + 1;
  }

  return (
    <div className="space-y-6">
      {[...classesByGrade.keys()].sort().map((grade) => {
        const list = classesByGrade.get(grade)!;
        return (
          <div key={grade} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
              <h2 className="font-bold text-slate-900">{grade}학년 순위</h2>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="w-14 px-5 py-2">순위</th>
                  <th className="px-2 py-2">반</th>
                  <th className="px-2 py-2 text-right">운동장</th>
                  <th className="px-2 py-2 text-right">체육관</th>
                  <th className="px-2 py-2 text-right">미니게임</th>
                  <th className="px-2 py-2 text-right">응원·질서</th>
                  <th className="px-5 py-2 text-right">총점</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => {
                  const data = classComputed.get(c.id)!;
                  const rank = rankFor(list, c.id);
                  const isOpen = expanded.has(c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr
                        onClick={() => toggle(c.id)}
                        className="cursor-pointer border-b border-slate-50 hover:bg-slate-50"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-700">
                          {MEDAL[rank - 1] ?? rank}
                        </td>
                        <td className="px-2 py-2.5 font-medium text-slate-800">
                          {classLabel(c)}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {data.byCategory.field}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {data.byCategory.gym}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {data.byCategory.minigame}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {data.byCategory.cheer}
                        </td>
                        <td className="px-5 py-2.5 text-right text-base font-bold text-blue-700">
                          {data.total}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-slate-50 bg-slate-50/60">
                          <td colSpan={7} className="px-5 py-3">
                            {data.details.length === 0 ? (
                              <p className="text-xs text-slate-400">아직 제출된 점수가 없습니다.</p>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {data.details
                                  .sort((a, b) => a.event.order_index - b.event.order_index)
                                  .map(({ event, score }) => (
                                    <span
                                      key={score.id}
                                      className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600"
                                    >
                                      {event.name}{" "}
                                      <b className="text-slate-800">{score.computed_points}점</b>
                                    </span>
                                  ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
