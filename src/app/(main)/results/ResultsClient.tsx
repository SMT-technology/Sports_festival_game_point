"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type { ClassRow, EventCategory, EventRow, Role, ScoreRow } from "@/lib/database.types";
import { DetailedTable } from "./DetailedTable";
import { PodiumBoard } from "./PodiumBoard";
import type { ClassComputed } from "./types";

const CATEGORY_ORDER: EventCategory[] = ["relay", "minigame", "cheer"];

export function ResultsClient({
  role,
  initialClasses,
  initialEvents,
  initialScores,
}: {
  role: Role;
  initialClasses: ClassRow[];
  initialEvents: EventRow[];
  initialScores: ScoreRow[];
}) {
  const [scores, setScores] = useState<ScoreRow[]>(initialScores);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [live, setLive] = useState(false);
  const [view, setView] = useState<"detailed" | "podium">("detailed");

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
      map.set(c.id, { total: 0, byCategory: { relay: 0, minigame: 0, cheer: 0 }, details: [] });
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
      const totalSlots = catEvents.length * initialClasses.length;
      const done = finalScores.filter((s) => eventsById.get(s.event_id)?.category === cat).length;
      return { cat, done, totalSlots, events: catEvents.length };
    });
  }, [events, initialClasses.length, finalScores, eventsById]);

  const showPodium = role !== "admin" || view === "podium";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">🏆 실시간 결과</h1>
          <p className="mt-1 text-xs text-slate-500">
            최종 제출된 점수만 집계됩니다 · {lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신
          </p>
        </div>
        <div className="flex items-center gap-3">
          {role === "admin" && (
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
          )}
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-slate-300"}`} />
            {live ? "실시간 연결됨" : "연결 중..."}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
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

      {showPodium ? (
        <PodiumBoard classesByGrade={classesByGrade} classComputed={classComputed} />
      ) : (
        <DetailedTable classesByGrade={classesByGrade} classComputed={classComputed} />
      )}
    </div>
  );
}
