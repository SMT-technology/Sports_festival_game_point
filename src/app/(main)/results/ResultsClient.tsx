"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL, classLabel } from "@/lib/scoring";
import type { ClassRow, EventCategory, EventRow, ScoreRow } from "@/lib/database.types";

const CATEGORY_ORDER: EventCategory[] = ["relay", "minigame", "cheer"];
const MEDAL = ["🥇", "🥈", "🥉"];

export function ResultsClient({
  initialClasses,
  initialEvents,
  initialScores,
}: {
  initialClasses: ClassRow[];
  initialEvents: EventRow[];
  initialScores: ScoreRow[];
}) {
  const [scores, setScores] = useState<ScoreRow[]>(initialScores);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("results-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        (payload) => {
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
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const next = payload.new as EventRow;
          setEvents((prev) => {
            const idx = prev.findIndex((e) => e.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const finalScores = useMemo(() => scores.filter((s) => s.status === "final"), [scores]);

  const classComputed = useMemo(() => {
    const map = new Map<
      string,
      {
        total: number;
        byCategory: Record<EventCategory, number>;
        details: { event: EventRow; score: ScoreRow }[];
      }
    >();

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900">🏆 실시간 결과</h1>
          <p className="mt-1 text-xs text-slate-500">
            최종 제출된 점수만 집계됩니다 · {lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신
          </p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <span
            className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-slate-300"}`}
          />
          {live ? "실시간 연결됨" : "연결 중..."}
        </span>
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
                  <th className="px-2 py-2 text-right">반대항전</th>
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
                          {data.byCategory.relay}
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
                          <td colSpan={6} className="px-5 py-3">
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
