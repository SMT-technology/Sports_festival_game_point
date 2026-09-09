"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AppSettings, CheerAward, EventRow, ScoreRow } from "@/lib/database.types";

// 결과 탭(교사/학생용 순위 화면)과 관리자용 결과 관리 화면이 똑같은 데이터를
// 보고 있어야 하므로, 실시간 구독 + 새로고침 로직을 한 군데에 모아서
// 두 화면이 함께 쓴다.
export function useResultsData(initial: {
  scores: ScoreRow[];
  events: EventRow[];
  awards: CheerAward[];
  rankingsVisible: boolean;
  cheerResultsVisible: boolean;
}) {
  const [scores, setScores] = useState<ScoreRow[]>(initial.scores);
  const [events, setEvents] = useState<EventRow[]>(initial.events);
  const [awards, setAwards] = useState<CheerAward[]>(initial.awards);
  const [rankingsVisible, setRankingsVisible] = useState(initial.rankingsVisible);
  const [cheerResultsVisible, setCheerResultsVisible] = useState(initial.cheerResultsVisible);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [live, setLive] = useState(false);
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

  async function updateSettings(
    patch: Partial<Pick<AppSettings, "rankings_visible" | "cheer_results_visible">>,
  ) {
    const supabase = createClient();
    const { error } = await supabase.from("app_settings").update(patch).eq("id", 1);
    return error;
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

  return {
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
  };
}
