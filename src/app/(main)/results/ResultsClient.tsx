"use client";

import { useMemo } from "react";
import type { CheerAward, ClassRow, EventRow, ScoreRow } from "@/lib/database.types";
import { CheerAwardsBoard } from "@/components/results/CheerAwardsBoard";
import { PodiumBoard } from "@/components/results/PodiumBoard";
import { useResultsData } from "@/components/results/useResultsData";
import type { ClassComputed } from "@/components/results/types";

export function ResultsClient({
  initialClasses,
  initialEvents,
  initialScores,
  initialRankingsVisible,
  initialCheerResultsVisible,
  cheerAwards,
}: {
  initialClasses: ClassRow[];
  initialEvents: EventRow[];
  initialScores: ScoreRow[];
  initialRankingsVisible: boolean;
  initialCheerResultsVisible: boolean;
  cheerAwards: CheerAward[];
}) {
  const { scores, events, awards, rankingsVisible, cheerResultsVisible, lastUpdate, live, refreshing, refresh } =
    useResultsData({
      scores: initialScores,
      events: initialEvents,
      awards: cheerAwards,
      rankingsVisible: initialRankingsVisible,
      cheerResultsVisible: initialCheerResultsVisible,
    });

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const finalScores = useMemo(() => scores.filter((s) => s.status === "final"), [scores]);

  const classComputed: ClassComputed = useMemo(() => {
    const map: ClassComputed = new Map();

    for (const c of initialClasses) {
      map.set(c.id, { total: 0, details: [] });
    }

    for (const s of finalScores) {
      const ev = eventsById.get(s.event_id);
      if (!ev) continue;
      const entry = map.get(s.class_id);
      if (!entry) continue;
      entry.total += s.computed_points;
      entry.details.push({ event: ev, score: s });
    }

    return map;
  }, [initialClasses, finalScores, eventsById]);

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of initialClasses) {
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) => (classComputed.get(b.id)?.total ?? 0) - (classComputed.get(a.id)?.total ?? 0),
      );
    }
    return map;
  }, [initialClasses, classComputed]);

  const cheerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of awards) map.set(a.class_id, (map.get(a.class_id) ?? 0) + a.points);
    return map;
  }, [awards]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">🎉 실시간 현재 순위</h1>
          <p className="mt-1 text-xs text-slate-500">
            최종 제출된 점수만 집계됩니다 · {lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={refreshing ? "inline-block animate-spin" : ""}>🔄</span>
            {refreshing ? "갱신 중..." : "순위 갱신"}
          </button>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-slate-300"}`} />
            {live ? "실시간 연결됨" : "연결 중..."}
          </span>
        </div>
      </div>

      <PodiumBoard
        classesByGrade={classesByGrade}
        classComputed={classComputed}
        rankingsVisible={rankingsVisible}
      />

      {cheerResultsVisible && (
        <CheerAwardsBoard classesByGrade={classesByGrade} cheerTotals={cheerTotals} />
      )}
    </div>
  );
}
