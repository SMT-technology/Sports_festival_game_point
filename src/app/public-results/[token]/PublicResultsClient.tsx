"use client";

import { useEffect, useMemo, useState } from "react";
import { PodiumBoard } from "@/components/results/PodiumBoard";
import { CheerAwardsBoard } from "@/components/results/CheerAwardsBoard";
import type { CheerAward, ClassRow, EventRow, ScoreRow } from "@/lib/database.types";
import type { ClassComputed } from "@/components/results/types";

const POLL_INTERVAL_MS = 8000;

export function PublicResultsClient({
  token,
  orgName,
  logoUrl,
  initialClasses,
  initialEvents,
  initialScores,
  initialCheerAwards,
  initialRankingsVisible,
  initialCheerResultsVisible,
}: {
  token: string;
  orgName: string;
  logoUrl: string;
  initialClasses: ClassRow[];
  initialEvents: EventRow[];
  initialScores: ScoreRow[];
  initialCheerAwards: CheerAward[];
  initialRankingsVisible: boolean;
  initialCheerResultsVisible: boolean;
}) {
  const [classes, setClasses] = useState(initialClasses);
  const [events, setEvents] = useState(initialEvents);
  const [scores, setScores] = useState(initialScores);
  const [cheerAwards, setCheerAwards] = useState(initialCheerAwards);
  const [rankingsVisible, setRankingsVisible] = useState(initialRankingsVisible);
  const [cheerResultsVisible, setCheerResultsVisible] = useState(initialCheerResultsVisible);
  // 서버(SSR)와 브라우저의 로케일/시간대 표시 방식이 미묘하게 달라 하이드레이션
  // 불일치가 날 수 있어, 처음엔 null로 뒀다가 클라이언트에서만 채운다.
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mark = () => setLastUpdate(new Date());
    mark();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/public-results?token=${encodeURIComponent(token)}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          setError("링크가 만료되었거나 잘못됐어요. 담임선생님/관리자에게 새 링크를 요청하세요.");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setClasses(data.classes);
        setEvents(data.events);
        setScores(data.scores);
        setCheerAwards(data.cheerAwards);
        setRankingsVisible(data.rankingsVisible);
        setCheerResultsVisible(data.cheerResultsVisible);
        setLastUpdate(new Date());
        setError(null);
      } catch {
        // 네트워크 문제는 조용히 무시하고 다음 폴링에서 다시 시도한다.
      }
    }

    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const finalScores = useMemo(() => scores.filter((s) => s.status === "final"), [scores]);

  const classComputed: ClassComputed = useMemo(() => {
    const map: ClassComputed = new Map();
    for (const c of classes) map.set(c.id, { total: 0, details: [] });
    for (const s of finalScores) {
      const ev = eventsById.get(s.event_id);
      if (!ev) continue;
      const entry = map.get(s.class_id);
      if (!entry) continue;
      entry.total += s.computed_points;
      entry.details.push({ event: ev, score: s });
    }
    return map;
  }, [classes, finalScores, eventsById]);

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of classes) {
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    for (const [, list] of map) {
      list.sort(
        (a, b) => (classComputed.get(b.id)?.total ?? 0) - (classComputed.get(a.id)?.total ?? 0),
      );
    }
    return map;
  }, [classes, classComputed]);

  const cheerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of cheerAwards) map.set(a.class_id, (map.get(a.class_id) ?? 0) + a.points);
    return map;
  }, [cheerAwards]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-orange-500" />
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={`${orgName} 로고`}
            width={24}
            height={24}
            className="h-6 w-6 shrink-0 rounded-full object-cover"
          />
          <span className="text-sm font-bold text-slate-900">{orgName}</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <h1 className="text-lg font-bold text-slate-900">🏆 학년별 종합 순위</h1>
          <p className="mt-1 text-xs text-slate-500">
            {error ? (
              <span className="text-red-600">{error}</span>
            ) : lastUpdate ? (
              `${lastUpdate.toLocaleTimeString("ko-KR")} 기준 갱신 · 자동으로 새로고침됩니다`
            ) : (
              "불러오는 중..."
            )}
          </p>
        </div>

        <PodiumBoard
          classesByGrade={classesByGrade}
          classComputed={classComputed}
          rankingsVisible={rankingsVisible}
        />

        {cheerResultsVisible && (
          <CheerAwardsBoard classesByGrade={classesByGrade} cheerTotals={cheerTotals} />
        )}
      </main>
    </div>
  );
}
