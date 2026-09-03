"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL, classLabel, previewPoints } from "@/lib/scoring";
import type {
  ClassRow,
  EventRow,
  Profile,
  ScoreAuditLog,
  ScoreRow,
} from "@/lib/database.types";

interface RowState {
  scoreId?: string;
  rank: number | null;
  pass: boolean | null;
  direct: number | null;
  status: "empty" | "draft" | "final";
  saving?: boolean;
}

function emptyRow(): RowState {
  return { rank: null, pass: null, direct: null, status: "empty" };
}

function rowFromScore(score: ScoreRow): RowState {
  return {
    scoreId: score.id,
    rank: score.rank_value,
    pass: score.pass_value,
    direct: score.direct_value,
    status: score.status,
  };
}

const ACTION_LABEL: Record<ScoreAuditLog["action"], string> = {
  create: "생성",
  update: "수정",
  final_submit: "최종 제출",
  unlock: "잠금 해제",
  admin_edit: "관리자 수정",
};

export function AdminScoresClient({
  classes,
  events,
}: {
  classes: ClassRow[];
  events: EventRow[];
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const loading = selectedEventId !== null && loadedEventId !== selectedEventId;
  const [auditFor, setAuditFor] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<ScoreAuditLog[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of classes) {
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    return map;
  }, [classes]);

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
    return () => {
      cancelled = true;
    };
  }, [selectedEventId, classes]);

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
          id: row.scoreId,
          event_id: selectedEvent.id,
          class_id: classId,
          rank_value: selectedEvent.scoring_type === "rank" ? row.rank : null,
          pass_value: selectedEvent.scoring_type === "pass_fail" ? row.pass : null,
          direct_value: selectedEvent.scoring_type === "direct" ? row.direct : null,
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

  async function openAudit(classId: string) {
    const row = rows[classId];
    if (!row?.scoreId) return;
    setAuditFor(classId);
    const supabase = createClient();
    const { data } = await supabase
      .from("score_audit_log")
      .select("*")
      .eq("score_id", row.scoreId)
      .order("changed_at", { ascending: false });
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
      <div>
        <h1 className="text-lg font-bold text-slate-900">점수 직접 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          관리자는 잠금 여부와 관계없이 모든 점수를 직접 수정하고 변경 이력을 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {events.map((ev) => (
          <button
            key={ev.id}
            onClick={() => setSelectedEventId(ev.id)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
              ev.id === selectedEventId
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {CATEGORY_LABEL[ev.category]} · {ev.name}
          </button>
        ))}
      </div>

      {selectedEvent && (
        <div className="rounded-xl border border-slate-200 bg-white">
          {loading ? (
            <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {[...classesByGrade.keys()].sort().map((grade) => (
                <div key={grade}>
                  <div className="bg-slate-50 px-5 py-1.5 text-xs font-semibold text-slate-500">
                    {grade}학년
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
                          {row.scoreId && (
                            <button
                              onClick={() => openAudit(c.id)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              이력
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
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
              {auditLogs.length === 0 && (
                <p className="text-sm text-slate-400">기록이 없습니다.</p>
              )}
              {auditLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-100 p-3 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {ACTION_LABEL[log.action]}
                    </span>
                    <span>{new Date(log.changed_at).toLocaleString("ko-KR")}</span>
                  </div>
                  <p className="mt-1 text-slate-500">
                    처리자: {log.changed_by ? profilesById[log.changed_by]?.name ?? log.changed_by : "-"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
