"use client";

import { useMemo, useState } from "react";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type { CheerAward, ClassRow, EventCategory, EventRow, ScoreRow } from "@/lib/database.types";
import { CheerAwardsBoard } from "@/components/results/CheerAwardsBoard";
import { DetailedTable } from "@/components/results/DetailedTable";
import { SubmissionMatrix } from "@/components/results/SubmissionMatrix";
import { useResultsData } from "@/components/results/useResultsData";
import type { ClassComputed } from "@/components/results/types";

const CATEGORY_ORDER: EventCategory[] = ["field", "gym", "minigame"];

export function AdminResultsClient({
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
  const {
    scores,
    events,
    awards,
    rankingsVisible,
    cheerResultsVisible,
    lastUpdate,
    live,
    refreshing,
    refresh,
    updateSettings,
  } = useResultsData({
    scores: initialScores,
    events: initialEvents,
    awards: cheerAwards,
    rankingsVisible: initialRankingsVisible,
    cheerResultsVisible: initialCheerResultsVisible,
  });

  const [rankingsBusy, setRankingsBusy] = useState(false);
  const [cheerBusy, setCheerBusy] = useState(false);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const finalScores = useMemo(() => scores.filter((s) => s.status === "final"), [scores]);

  const classComputed: ClassComputed = useMemo(() => {
    const map: ClassComputed = new Map();

    for (const c of initialClasses) {
      map.set(c.id, {
        total: 0,
        byCategory: { field: 0, gym: 0, minigame: 0 },
        details: [],
      });
    }

    for (const s of finalScores) {
      const ev = eventsById.get(s.event_id);
      if (!ev) continue;
      const entry = map.get(s.class_id);
      if (!entry) continue;
      entry.total += s.computed_points;
      entry.byCategory[ev.category] += s.computed_points;
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

  const progress = useMemo(() => {
    return CATEGORY_ORDER.map((cat) => {
      const catEvents = events.filter((e) => e.category === cat);
      const totalSlots = catEvents.reduce(
        (sum, ev) => sum + initialClasses.filter((c) => ev.grades.includes(c.grade)).length,
        0,
      );
      const done = finalScores.filter((s) => eventsById.get(s.event_id)?.category === cat).length;
      return { cat, done, totalSlots, events: catEvents.length };
    });
  }, [events, initialClasses, finalScores, eventsById]);

  const cheerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of awards) map.set(a.class_id, (map.get(a.class_id) ?? 0) + a.points);
    return map;
  }, [awards]);

  async function toggleRankingsVisible() {
    setRankingsBusy(true);
    const error = await updateSettings({ rankings_visible: !rankingsVisible });
    setRankingsBusy(false);
    if (error) alert("변경 실패: " + error.message);
  }

  async function toggleCheerVisible() {
    setCheerBusy(true);
    const error = await updateSettings({ cheer_results_visible: !cheerResultsVisible });
    setCheerBusy(false);
    if (error) alert("변경 실패: " + error.message);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">📋 결과 관리</h1>
          <p className="mt-1 text-xs text-slate-500">
            최종 제출된 점수만 집계됩니다 · {lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleRankingsVisible}
            disabled={rankingsBusy}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              rankingsVisible
                ? "border-blue-300 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {rankingsVisible ? "👀 순위 공개 중" : "🙈 순위 비공개 (클릭해서 공개)"}
          </button>
          <button
            onClick={toggleCheerVisible}
            disabled={cheerBusy}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              cheerResultsVisible
                ? "border-amber-300 bg-amber-50 text-amber-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cheerResultsVisible ? "🎗️ 응원상 공개 중" : "🎗️ 응원상 비공개 (클릭해서 공개)"}
          </button>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {progress.map((p) => (
          <div key={p.cat} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-400">{CATEGORY_LABEL[p.cat]}</p>
            <p className="mt-1 text-sm text-slate-700">
              {p.done} / {p.totalSlots}건 제출 · {p.events}개 종목
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${p.totalSlots ? (p.done / p.totalSlots) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <SubmissionMatrix classes={initialClasses} events={events} finalScores={finalScores} />

      <DetailedTable classesByGrade={classesByGrade} classComputed={classComputed} />

      <div className="space-y-1">
        {!cheerResultsVisible && (
          <p className="text-xs text-slate-400">
            🔒 관리자에게만 보여요 — 교사/학생 화면에는 아직 공개되지 않았습니다.
          </p>
        )}
        <CheerAwardsBoard classesByGrade={classesByGrade} cheerTotals={cheerTotals} />
      </div>
    </div>
  );
}
