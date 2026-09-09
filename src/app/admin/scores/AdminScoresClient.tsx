"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  AUDIT_ACTION_LABEL,
  classLabel,
  describeScoreSnapshot,
  groupEventsByLocation,
  locationStyle,
  previewPoints,
} from "@/lib/scoring";
import type {
  CheerAward,
  ClassRow,
  EventLocation,
  EventRow,
  Profile,
  ScoreAuditLog,
  ScoreRow,
} from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface RowState {
  scoreId?: string;
  rank: number | null;
  pass: boolean | null;
  direct: number | null;
  tier: number | null;
  status: "empty" | "draft" | "final";
  saving?: boolean;
}

function emptyRow(): RowState {
  return { rank: null, pass: null, direct: null, tier: null, status: "empty" };
}

function rowFromScore(score: ScoreRow): RowState {
  return {
    scoreId: score.id,
    rank: score.rank_value,
    pass: score.pass_value,
    direct: score.direct_value,
    tier: score.tier_index,
    status: score.status,
  };
}

const GRADE_STYLE: Record<number, { border: string; header: string; badge: string }> = {
  1: { border: "border-blue-400", header: "bg-blue-50", badge: "bg-blue-600 text-white" },
  2: { border: "border-purple-400", header: "bg-purple-50", badge: "bg-purple-600 text-white" },
  3: { border: "border-green-400", header: "bg-green-50", badge: "bg-green-600 text-white" },
};

export function AdminScoresClient({
  classes,
  events,
  initialCheerAwards,
  locations,
}: {
  classes: ClassRow[];
  events: EventRow[];
  initialCheerAwards: CheerAward[];
  locations: EventLocation[];
}) {
  const [viewMode, setViewMode] = useState<"event" | "cheer">("event");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const loading = selectedEventId !== null && loadedEventId !== selectedEventId;
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [live, setLive] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ classId: string; className: string } | null>(
    null,
  );
  const [bulkFinalizeOpen, setBulkFinalizeOpen] = useState(false);
  const [bulkResetOpen, setBulkResetOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  const [cheerAwards, setCheerAwards] = useState<CheerAward[]>(initialCheerAwards);
  const [cheerResetTarget, setCheerResetTarget] = useState<{
    classId: string;
    className: string;
  } | null>(null);
  const [cheerBulkResetOpen, setCheerBulkResetOpen] = useState(false);
  const [cheerBusy, setCheerBusy] = useState(false);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const locationGroups = useMemo(
    () => groupEventsByLocation(events, locations),
    [events, locations],
  );

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of classes) {
      if (selectedEvent && !selectedEvent.grades.includes(c.grade)) continue;
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    return map;
  }, [classes, selectedEvent]);

  const allClassesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of classes) {
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    return map;
  }, [classes]);

  const cheerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of cheerAwards) map.set(a.class_id, (map.get(a.class_id) ?? 0) + a.points);
    return map;
  }, [cheerAwards]);

  const cheerResetTargets = useMemo(
    () => classes.filter((c) => cheerAwards.some((a) => a.class_id === c.id)),
    [classes, cheerAwards],
  );

  useEffect(() => {
    if (!selectedEventId) return;
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("scores")
      .select("*")
      .eq("event_id", selectedEventId)
      .then(({ data }) => {
        if (cancelled) return;
        const next: Record<string, RowState> = {};
        for (const c of classes) next[c.id] = emptyRow();
        for (const s of (data ?? []) as ScoreRow[]) next[s.class_id] = rowFromScore(s);
        setRows(next);
        setLoadedEventId(selectedEventId);
      });

    // 교사가 입력 탭에서 직접 제출/취소할 때 이 화면도 새로고침 없이 바로
    // 반영되도록 실시간 구독을 건다 (기존에는 처음 한 번만 불러오고 끝이라,
    // 관리자가 이 화면을 켜둔 채로 있으면 교사 쪽 변경이 안 보였음).
    const channel = supabase
      .channel(`admin-scores-${selectedEventId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores", filter: `event_id=eq.${selectedEventId}` },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedId = (payload.old as { id?: string }).id;
            if (!deletedId) return;
            setRows((prev) => {
              const classId = Object.keys(prev).find((cid) => prev[cid]?.scoreId === deletedId);
              if (!classId) return prev;
              return { ...prev, [classId]: emptyRow() };
            });
            return;
          }
          const s = payload.new as ScoreRow;
          setRows((prev) => ({ ...prev, [s.class_id]: rowFromScore(s) }));
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, classes]);

  // 응원 점수도 교사가 다른 화면(🎉 응원점수)에서 지급/차감할 때 바로 보이도록
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-cheer-awards-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cheer_awards" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as CheerAward;
            setCheerAwards((prev) => prev.filter((a) => a.id !== old.id));
            return;
          }
          const next = payload.new as CheerAward;
          setCheerAwards((prev) => {
            const idx = prev.findIndex((a) => a.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function refresh() {
    setRefreshing(true);
    const supabase = createClient();
    const [scoresRes, cheerRes] = await Promise.all([
      selectedEventId
        ? supabase.from("scores").select("*").eq("event_id", selectedEventId)
        : Promise.resolve({ data: null }),
      supabase.from("cheer_awards").select("*"),
    ]);
    if (selectedEventId && scoresRes.data) {
      const next: Record<string, RowState> = {};
      for (const c of classes) next[c.id] = emptyRow();
      for (const s of scoresRes.data as ScoreRow[]) next[s.class_id] = rowFromScore(s);
      setRows(next);
    }
    if (cheerRes.data) setCheerAwards(cheerRes.data as CheerAward[]);
    setRefreshing(false);
  }

  function updateRow(classId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [classId]: { ...prev[classId], ...patch } }));
  }

  async function save(classId: string, status: "draft" | "final") {
    if (!selectedEvent) return;
    const row = rows[classId];
    updateRow(classId, { saving: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scores")
      .upsert(
        {
          event_id: selectedEvent.id,
          class_id: classId,
          rank_value: selectedEvent.scoring_type === "rank" ? row.rank : null,
          pass_value: selectedEvent.scoring_type === "pass_fail" ? row.pass : null,
          direct_value: selectedEvent.scoring_type === "direct" ? row.direct : null,
          tier_index: selectedEvent.scoring_type === "tier" ? row.tier : null,
          status,
        },
        { onConflict: "event_id,class_id" },
      )
      .select()
      .single();
    if (error) {
      alert("저장 실패: " + error.message);
      updateRow(classId, { saving: false });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: rowFromScore(data as ScoreRow) }));
  }

  async function resetScore(classId: string) {
    const row = rows[classId];
    if (!row?.scoreId) {
      setResetTarget(null);
      return;
    }
    updateRow(classId, { saving: true });
    const supabase = createClient();
    const { error } = await supabase.from("scores").delete().eq("id", row.scoreId);
    setResetTarget(null);
    if (error) {
      alert("초기화 실패: " + error.message);
      updateRow(classId, { saving: false });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: emptyRow() }));
  }

  function hasValue(row: RowState): boolean {
    if (!selectedEvent) return false;
    if (selectedEvent.scoring_type === "rank") return row.rank != null;
    if (selectedEvent.scoring_type === "pass_fail") return row.pass != null;
    if (selectedEvent.scoring_type === "direct") return row.direct != null;
    if (selectedEvent.scoring_type === "tier") return row.tier != null;
    return false;
  }

  const finalizeTargets = useMemo(
    () => classes.filter((c) => rows[c.id] && rows[c.id].status !== "final" && hasValue(rows[c.id])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classes, rows, selectedEvent],
  );

  const resetTargets = useMemo(
    () => classes.filter((c) => rows[c.id]?.scoreId),
    [classes, rows],
  );

  async function finalizeAll() {
    if (!selectedEvent || finalizeTargets.length === 0) {
      setBulkFinalizeOpen(false);
      return;
    }
    setBulkSaving(true);
    const payload = finalizeTargets.map((c) => {
      const row = rows[c.id];
      return {
        event_id: selectedEvent.id,
        class_id: c.id,
        rank_value: selectedEvent.scoring_type === "rank" ? row.rank : null,
        pass_value: selectedEvent.scoring_type === "pass_fail" ? row.pass : null,
        direct_value: selectedEvent.scoring_type === "direct" ? row.direct : null,
        tier_index: selectedEvent.scoring_type === "tier" ? row.tier : null,
        status: "final" as const,
      };
    });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scores")
      .upsert(payload, { onConflict: "event_id,class_id" })
      .select();
    setBulkSaving(false);
    setBulkFinalizeOpen(false);
    if (error) {
      alert("전체 최종 확정 실패: " + error.message);
      return;
    }
    setRows((prev) => {
      const next = { ...prev };
      for (const s of (data ?? []) as ScoreRow[]) next[s.class_id] = rowFromScore(s);
      return next;
    });
  }

  async function resetAll() {
    if (resetTargets.length === 0) {
      setBulkResetOpen(false);
      return;
    }
    setBulkSaving(true);
    const ids = resetTargets.map((c) => rows[c.id].scoreId as string);
    const supabase = createClient();
    const { error } = await supabase.from("scores").delete().in("id", ids);
    setBulkSaving(false);
    setBulkResetOpen(false);
    if (error) {
      alert("전체 초기화 실패: " + error.message);
      return;
    }
    setRows((prev) => {
      const next = { ...prev };
      for (const c of resetTargets) next[c.id] = emptyRow();
      return next;
    });
  }

  async function resetCheerForClass(classId: string) {
    setCheerBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("cheer_awards").delete().eq("class_id", classId);
    setCheerBusy(false);
    setCheerResetTarget(null);
    if (error) {
      alert("초기화 실패: " + error.message);
      return;
    }
    setCheerAwards((prev) => prev.filter((a) => a.class_id !== classId));
  }

  async function resetAllCheer() {
    if (cheerResetTargets.length === 0) {
      setCheerBulkResetOpen(false);
      return;
    }
    setCheerBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cheer_awards")
      .delete()
      .in(
        "class_id",
        cheerResetTargets.map((c) => c.id),
      );
    setCheerBusy(false);
    setCheerBulkResetOpen(false);
    if (error) {
      alert("전체 초기화 실패: " + error.message);
      return;
    }
    const resetIds = new Set(cheerResetTargets.map((c) => c.id));
    setCheerAwards((prev) => prev.filter((a) => !resetIds.has(a.class_id)));
  }

  async function openAudit(classId: string) {
    if (!selectedEvent) return;
    setAuditFor(classId);
    setAuditError(null);
    setAuditLogs([]);
    const supabase = createClient();
    // score_id 기준이 아니라 event_id + class_id 기준으로 조회한다.
    // 점수를 "초기화"하면 기존 행이 삭제되고 새 id로 다시 생성되기 때문에,
    // score_id로만 조회하면 초기화 이전 이력이 안 보이는 문제가 있었음.
    const { data, error } = await supabase
      .from("score_audit_log")
      .select("*")
      .eq("event_id", selectedEvent.id)
      .eq("class_id", classId)
      .order("changed_at", { ascending: false });
    if (error) {
      setAuditError("이력을 불러오지 못했습니다: " + error.message);
      return;
    }
    const logs = (data ?? []) as ScoreAuditLog[];
    setAuditLogs(logs);

    const ids = [...new Set(logs.map((l) => l.changed_by).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: people } = await supabase.from("profiles").select("*").in("id", ids);
      const map: Record<string, Profile> = {};
      for (const p of (people ?? []) as Profile[]) map[p.id] = p;
      setProfilesById(map);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900">🔄 점수 초기화 / 직접 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            교사가 최종 제출한 점수는 본인이 스스로 고칠 수 없어요. 잘못 입력된 점수는 여기서
            관리자가 초기화하거나 직접 수정할 수 있습니다.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <span className={refreshing ? "inline-block animate-spin" : ""}>🔄</span>
            {refreshing ? "갱신 중..." : "새로고침"}
          </button>
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500" : "bg-slate-300"}`} />
            {live ? "실시간 연결됨" : "연결 중..."}
          </span>
        </div>
      </div>

      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-semibold">
        <button
          onClick={() => setViewMode("event")}
          className={`rounded-md px-4 py-1.5 ${
            viewMode === "event" ? "bg-white text-blue-700 shadow" : "text-slate-500"
          }`}
        >
          🏷️ 종목별 점수
        </button>
        <button
          onClick={() => setViewMode("cheer")}
          className={`rounded-md px-4 py-1.5 ${
            viewMode === "cheer" ? "bg-white text-amber-600 shadow" : "text-slate-500"
          }`}
        >
          🎉 응원·질서 점수
        </button>
      </div>

      {viewMode === "cheer" ? (
        <div className="rounded-xl border border-amber-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">🎉 응원·질서 점수 초기화</h2>
              <p className="text-xs text-slate-500">
                반이 지급받은 응원 점수 이력을 전부 삭제해서 0점으로 되돌립니다.
              </p>
            </div>
            <button
              onClick={() => setCheerBulkResetOpen(true)}
              disabled={cheerResetTargets.length === 0 || cheerBusy}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              🔄 모두 초기화{cheerResetTargets.length > 0 && ` (${cheerResetTargets.length})`}
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {[...allClassesByGrade.keys()].sort().map((grade) => {
              const style = GRADE_STYLE[grade];
              return (
                <div key={grade} className={`border-l-4 ${style.border}`}>
                  <div className={`flex items-center gap-2 px-5 py-2 ${style.header}`}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                      {grade}학년
                    </span>
                  </div>
                  {allClassesByGrade.get(grade)!.map((c) => {
                    const total = cheerTotals.get(c.id) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm"
                      >
                        <span className="w-20 shrink-0 font-medium text-slate-700">
                          {classLabel(c)}
                        </span>
                        <span className="text-lg font-extrabold text-amber-600">{total}점</span>
                        <div className="ml-auto">
                          <button
                            disabled={total === 0 || cheerBusy}
                            onClick={() =>
                              setCheerResetTarget({ classId: c.id, className: classLabel(c) })
                            }
                            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                          >
                            🔄 초기화
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
      <div className="space-y-3">
        {locationGroups.map((group, i) => {
          const style = locationStyle(i);
          return (
            <div key={group.name} className={`overflow-hidden rounded-xl border ${style.border} bg-white`}>
              <div className={`px-4 py-2 text-sm font-bold ${style.header}`}>
                {group.emoji} {group.name}
              </div>
              <div className="flex flex-wrap gap-2 p-3">
                {group.events.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                      ev.id === selectedEventId
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {ev.name}{" "}
                    <span className="text-xs opacity-70">({ev.grades.join(",")}학년)</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvent && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">{selectedEvent.name}</h2>
              <p className="text-xs text-slate-500">
                {selectedEvent.category} ·{" "}
                {selectedEvent.scoring_type === "rank" && "순위 입력 (배점표 자동 적용)"}
                {selectedEvent.scoring_type === "pass_fail" &&
                  `통과/실패 (통과 시 ${selectedEvent.pass_points}점)`}
                {selectedEvent.scoring_type === "direct" &&
                  `직접 입력 (0~${selectedEvent.max_points}점)`}
                {selectedEvent.scoring_type === "tier" && "사용자 설정 점수"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkResetOpen(true)}
                disabled={resetTargets.length === 0 || bulkSaving}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
              >
                🔄 모두 초기화{resetTargets.length > 0 && ` (${resetTargets.length})`}
              </button>
              <button
                onClick={() => setBulkFinalizeOpen(true)}
                disabled={finalizeTargets.length === 0 || bulkSaving}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
              >
                ✅ 모두 최종 확정{finalizeTargets.length > 0 && ` (${finalizeTargets.length})`}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...classesByGrade.keys()].sort().map((grade) => {
                const style = GRADE_STYLE[grade];
                return (
                <div key={grade} className={`border-l-4 ${style.border}`}>
                  <div className={`flex items-center gap-2 px-5 py-2 ${style.header}`}>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                      {grade}학년
                    </span>
                    <span className="text-xs text-slate-400">
                      {classesByGrade.get(grade)!.length}개 반
                    </span>
                  </div>
                  {classesByGrade.get(grade)!.map((c) => {
                    const row = rows[c.id] ?? emptyRow();
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm"
                      >
                        <span className="w-20 shrink-0 font-medium text-slate-700">
                          {classLabel(c)}
                        </span>

                        {selectedEvent.scoring_type === "rank" && (
                          <input
                            type="number"
                            min={1}
                            value={row.rank ?? ""}
                            onChange={(e) =>
                              updateRow(c.id, {
                                rank: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        )}
                        {selectedEvent.scoring_type === "pass_fail" && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => updateRow(c.id, { pass: true })}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                row.pass === true
                                  ? "border-green-600 bg-green-50 text-green-700"
                                  : "border-slate-200 text-slate-500"
                              }`}
                            >
                              통과
                            </button>
                            <button
                              onClick={() => updateRow(c.id, { pass: false })}
                              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                row.pass === false
                                  ? "border-red-600 bg-red-50 text-red-700"
                                  : "border-slate-200 text-slate-500"
                              }`}
                            >
                              실패
                            </button>
                          </div>
                        )}
                        {selectedEvent.scoring_type === "direct" && (
                          <input
                            type="number"
                            min={0}
                            max={selectedEvent.max_points}
                            value={row.direct ?? ""}
                            onChange={(e) =>
                              updateRow(c.id, {
                                direct: e.target.value === "" ? null : Number(e.target.value),
                              })
                            }
                            className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                          />
                        )}
                        {selectedEvent.scoring_type === "tier" && (
                          <div className="flex flex-wrap gap-1.5">
                            {selectedEvent.tier_options.length === 0 && (
                              <span className="text-xs text-red-500">
                                관리자가 아직 단계를 설정하지 않았어요
                              </span>
                            )}
                            {selectedEvent.tier_options.map((t, i) => (
                              <button
                                key={i}
                                onClick={() => updateRow(c.id, { tier: i })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                                  row.tier === i
                                    ? "border-fuchsia-600 bg-fuchsia-50 text-fuchsia-700"
                                    : "border-slate-200 text-slate-500"
                                }`}
                              >
                                {t.label || `단계 ${i + 1}`}
                              </button>
                            ))}
                          </div>
                        )}

                        <span className="text-xs text-slate-400">
                          {previewPoints(selectedEvent, row).toFixed(0)}점
                        </span>

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            row.status === "final"
                              ? "bg-blue-50 text-blue-700"
                              : row.status === "draft"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-slate-100 text-slate-400"
                          }`}
                        >
                          {row.status === "final" ? "최종" : row.status === "draft" ? "임시" : "미입력"}
                        </span>

                        <div className="ml-auto flex shrink-0 gap-2">
                          <button
                            disabled={row.saving}
                            onClick={() => save(c.id, "draft")}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          >
                            임시저장
                          </button>
                          <button
                            disabled={row.saving}
                            onClick={() => save(c.id, "final")}
                            className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            최종 확정
                          </button>
                          <button
                            onClick={() => openAudit(c.id)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                          >
                            이력
                          </button>
                          {row.scoreId && (
                            <button
                              onClick={() =>
                                setResetTarget({ classId: c.id, className: classLabel(c) })
                              }
                              className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              🔄 초기화
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {auditFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">변경 이력</h2>
              <button
                onClick={() => setAuditFor(null)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {auditError && <p className="text-sm text-red-600">{auditError}</p>}
              {!auditError && auditLogs.length === 0 && (
                <p className="text-sm text-slate-400">기록이 없습니다.</p>
              )}
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 p-3 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {AUDIT_ACTION_LABEL[log.action]}
                    </span>
                    <span>{new Date(log.changed_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <p className="mt-1 font-medium text-slate-700">
                    {log.old_data && (
                      <>
                        <span className="text-slate-400 line-through">
                          {describeScoreSnapshot(selectedEvent, log.old_data)}
                        </span>{" "}
                        →{" "}
                      </>
                    )}
                    {describeScoreSnapshot(selectedEvent, log.new_data)}
                  </p>
                  <p className="mt-1 text-slate-500">
                    처리자: {log.changed_by ? profilesById[log.changed_by]?.name ?? log.changed_by : "-"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!resetTarget}
        title={`${resetTarget?.className ?? ""} 점수를 초기화하시겠습니까?`}
        description="입력된 점수가 완전히 삭제되어 미입력 상태로 돌아갑니다. 되돌릴 수 없습니다."
        confirmLabel="초기화"
        danger
        onCancel={() => setResetTarget(null)}
        onConfirm={() => resetTarget && resetScore(resetTarget.classId)}
        loading={resetTarget ? rows[resetTarget.classId]?.saving : false}
      />

      <ConfirmDialog
        open={bulkFinalizeOpen}
        title="이 종목의 모든 점수를 최종 확정하시겠습니까?"
        description={`입력된 ${finalizeTargets.length}개 반의 점수를 한 번에 최종 확정합니다. 결과 화면에 즉시 반영됩니다.`}
        confirmLabel="모두 최종 확정"
        onCancel={() => setBulkFinalizeOpen(false)}
        onConfirm={finalizeAll}
        loading={bulkSaving}
      />

      <ConfirmDialog
        open={bulkResetOpen}
        title="이 종목의 모든 점수를 초기화하시겠습니까?"
        description={`입력되어 있는 ${resetTargets.length}개 반의 점수가 전부 삭제되어 미입력 상태로 돌아갑니다. 되돌릴 수 없습니다.`}
        confirmLabel="모두 초기화"
        danger
        onCancel={() => setBulkResetOpen(false)}
        onConfirm={resetAll}
        loading={bulkSaving}
      />

      <ConfirmDialog
        open={!!cheerResetTarget}
        title={`${cheerResetTarget?.className ?? ""} 응원 점수를 초기화하시겠습니까?`}
        description="이 반에 지급된 응원 점수 이력이 전부 삭제되어 0점으로 돌아갑니다. 되돌릴 수 없습니다."
        confirmLabel="초기화"
        danger
        onCancel={() => setCheerResetTarget(null)}
        onConfirm={() => cheerResetTarget && resetCheerForClass(cheerResetTarget.classId)}
        loading={cheerBusy}
      />

      <ConfirmDialog
        open={cheerBulkResetOpen}
        title="모든 반의 응원 점수를 초기화하시겠습니까?"
        description={`응원 점수가 있는 ${cheerResetTargets.length}개 반의 지급 이력이 전부 삭제되어 0점으로 돌아갑니다. 되돌릴 수 없습니다.`}
        confirmLabel="모두 초기화"
        danger
        onCancel={() => setCheerBulkResetOpen(false)}
        onConfirm={resetAllCheer}
        loading={cheerBusy}
      />
    </div>
  );
}
