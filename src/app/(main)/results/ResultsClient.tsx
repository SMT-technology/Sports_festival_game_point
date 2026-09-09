"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type {
  AppSettings,
  CheerAward,
  ClassRow,
  EventCategory,
  EventRow,
  Role,
  ScoreRow,
} from "@/lib/database.types";
import { CheerAwardsBoard } from "./CheerAwardsBoard";
import { DetailedTable } from "./DetailedTable";
import { PodiumBoard } from "./PodiumBoard";
import { SubmissionMatrix } from "./SubmissionMatrix";
import type { ClassComputed } from "./types";

const CATEGORY_ORDER: EventCategory[] = ["field", "gym", "minigame"];

export function ResultsClient({
  role,
  initialClasses,
  initialEvents,
  initialScores,
  initialRankingsVisible,
  initialCheerResultsVisible,
  cheerAwards,
}: {
  role: Role;
  initialClasses: ClassRow[];
  initialEvents: EventRow[];
  initialScores: ScoreRow[];
  initialRankingsVisible: boolean;
  initialCheerResultsVisible: boolean;
  cheerAwards: CheerAward[];
}) {
  const [scores, setScores] = useState<ScoreRow[]>(initialScores);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [awards, setAwards] = useState<CheerAward[]>(cheerAwards);
  const [rankingsVisible, setRankingsVisible] = useState(initialRankingsVisible);
  const [rankingsBusy, setRankingsBusy] = useState(false);
  const [cheerResultsVisible, setCheerResultsVisible] = useState(initialCheerResultsVisible);
  const [cheerBusy, setCheerBusy] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [live, setLive] = useState(false);
  const [view, setView] = useState<"detailed" | "podium">("detailed");
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    const supabase = createClient();
    const [{ data: scoresData }, { data: eventsData }, { data: settingsData }, { data: awardsData }] =
      await Promise.all([
        supabase.from("scores").select("*"),
        supabase.from("events").select("*").eq("is_active", true),
        supabase.from("app_settings").select("*").eq("id", 1).single(),
        supabase.from("cheer_awards").select("*"),
      ]);
    if (scoresData) setScores(scoresData as ScoreRow[]);
    if (eventsData) setEvents(eventsData as EventRow[]);
    if (awardsData) setAwards(awardsData as CheerAward[]);
    const settings = settingsData as AppSettings | null;
    if (typeof settings?.rankings_visible === "boolean") setRankingsVisible(settings.rankings_visible);
    if (typeof settings?.cheer_results_visible === "boolean")
      setCheerResultsVisible(settings.cheer_results_visible);
    setLastUpdate(new Date());
    setRefreshing(false);
  }

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("results-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "scores" }, (payload) => {
        setLastUpdate(new Date());
        setScores((prev) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as ScoreRow;
            return prev.filter((s) => s.id !== old.id);
          }
          const next = payload.new as ScoreRow;
          const idx = prev.findIndex((s) => s.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = [...prev];
          copy[idx] = next;
          return copy;
        });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, (payload) => {
        if (payload.eventType === "DELETE") return;
        const next = payload.new as EventRow;
        setEvents((prev) => {
          const idx = prev.findIndex((e) => e.id === next.id);
          if (idx === -1) return [...prev, next];
          const copy = [...prev];
          copy[idx] = next;
          return copy;
        });
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload) => {
          const next = payload.new as AppSettings;
          if (typeof next?.rankings_visible === "boolean") {
            setRankingsVisible(next.rankings_visible);
          }
          if (typeof next?.cheer_results_visible === "boolean") {
            setCheerResultsVisible(next.cheer_results_visible);
          }
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

  const showPodium = role !== "admin" || view === "podium";

  async function toggleRankingsVisible() {
    setRankingsBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({ rankings_visible: !rankingsVisible })
      .eq("id", 1);
    setRankingsBusy(false);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    setRankingsVisible((v) => !v);
  }

  async function toggleCheerVisible() {
    setCheerBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({ cheer_results_visible: !cheerResultsVisible })
      .eq("id", 1);
    setCheerBusy(false);
    if (error) {
      alert("변경 실패: " + error.message);
      return;
    }
    setCheerResultsVisible((v) => !v);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">
            {showPodium ? "🎉 실시간 현재 순위" : "📋 결과 관리"}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            최종 제출된 점수만 집계됩니다 · {lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role === "admin" && (
            <>
              <button
                onClick={toggleRankingsVisible}
                disabled={rankingsBusy}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
                  rankingsVisible
                    ? "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    : "border-red-200 bg-red-50 text-red-600"
                }`}
              >
                {rankingsVisible ? "🙈 순위 숨기기" : "👀 순위 비공개 중 (클릭해서 공개)"}
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
              <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold">
                <button
                  onClick={() => setView("detailed")}
                  className={`rounded-md px-3 py-1.5 ${
                    view === "detailed" ? "bg-white text-blue-700 shadow" : "text-slate-500"
                  }`}
                >
                  📋 상세 표
                </button>
                <button
                  onClick={() => setView("podium")}
                  className={`rounded-md px-3 py-1.5 ${
                    view === "podium" ? "bg-white text-orange-600 shadow" : "text-slate-500"
                  }`}
                >
                  🎉 학생용 화면
                </button>
              </div>
            </>
          )}
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

      {showPodium ? (
        <PodiumBoard
          classesByGrade={classesByGrade}
          classComputed={classComputed}
          rankingsVisible={rankingsVisible}
        />
      ) : (
        <>
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
        </>
      )}

      {(role === "admin" || cheerResultsVisible) && (
        <div className="space-y-1">
          {role === "admin" && !cheerResultsVisible && (
            <p className="text-xs text-slate-400">
              🔒 관리자에게만 보여요 — 교사/학생 화면에는 아직 공개되지 않았습니다.
            </p>
          )}
          <CheerAwardsBoard classesByGrade={classesByGrade} cheerTotals={cheerTotals} />
        </div>
      )}
    </div>
  );
}
