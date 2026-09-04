"use client";

import { useMemo } from "react";
import { CATEGORY_LABEL, sortEvents } from "@/lib/scoring";
import type { ClassRow, EventCategory, EventRow, ScoreRow } from "@/lib/database.types";

const CATEGORY_ORDER: EventCategory[] = ["field", "gym", "minigame", "cheer"];
const GRADES = [1, 2, 3] as const;

export function SubmissionMatrix({
  classes,
  events,
  finalScores,
}: {
  classes: ClassRow[];
  events: EventRow[];
  finalScores: ScoreRow[];
}) {
  const gradeSize = useMemo(() => {
    const map = new Map<number, number>();
    for (const c of classes) map.set(c.grade, (map.get(c.grade) ?? 0) + 1);
    return map;
  }, [classes]);

  // event_id -> grade -> 제출된 반 수
  const doneByEventGrade = useMemo(() => {
    const classById = new Map(classes.map((c) => [c.id, c]));
    const map = new Map<string, Map<number, number>>();
    for (const s of finalScores) {
      const cls = classById.get(s.class_id);
      if (!cls) continue;
      if (!map.has(s.event_id)) map.set(s.event_id, new Map());
      const evMap = map.get(s.event_id)!;
      evMap.set(cls.grade, (evMap.get(cls.grade) ?? 0) + 1);
    }
    return map;
  }, [classes, finalScores]);

  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map((cat) => {
        const catEvents = sortEvents(events.filter((e) => e.category === cat));
        if (catEvents.length === 0) return null;
        return (
          <div key={cat} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-700">
              {CATEGORY_LABEL[cat]} 학년별·종목별 제출 현황
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-slate-400">
                    <th className="px-4 py-2">종목</th>
                    {GRADES.map((g) => (
                      <th key={g} className="px-2 py-2 text-center">
                        {g}학년
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {catEvents.map((ev) => {
                    const evMap = doneByEventGrade.get(ev.id);
                    return (
                      <tr key={ev.id} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-2 font-medium text-slate-700">{ev.name}</td>
                        {GRADES.map((g) => {
                          const done = evMap?.get(g) ?? 0;
                          const total = gradeSize.get(g) ?? 0;
                          const complete = total > 0 && done === total;
                          return (
                            <td key={g} className="px-2 py-2 text-center">
                              <span
                                className={`inline-block min-w-[3.5rem] rounded-full px-2 py-0.5 font-semibold ${
                                  complete
                                    ? "bg-green-100 text-green-700"
                                    : done > 0
                                      ? "bg-amber-100 text-amber-700"
                                      : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {complete ? "✅ " : ""}
                                {done}/{total}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
