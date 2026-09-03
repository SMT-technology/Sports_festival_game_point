"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL, classLabel, previewPoints } from "@/lib/scoring";
import type { ClassRow, EventCategory, EventRow, Profile, ScoreRow } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface RowState {
  scoreId?: string;
  rank: number | null;
  pass: boolean | null;
  direct: number | null;
  status: "empty" | "draft" | "final";
  saving?: boolean;
  error?: string;
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

const CATEGORY_ORDER: EventCategory[] = ["relay", "minigame", "cheer"];

export function InputClient({
  profile,
  events,
  classes,
}: {
  profile: Profile;
  events: EventRow[];
  classes: ClassRow[];
}) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(events[0]?.id ?? null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const loading = selectedEventId !== null && loadedEventId !== selectedEventId;
  const [confirmTarget, setConfirmTarget] = useState<
    { classId: string; type: "final" | "unlock" } | null
  >(null);

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const grouped = useMemo(() => {
    const map = new Map<EventCategory, EventRow[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const ev of events) map.get(ev.category)?.push(ev);
    return map;
  }, [events]);

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
        for (const s of (data ?? []) as ScoreRow[]) {
          next[s.class_id] = rowFromScore(s);
        }
        setRows(next);
        setLoadedEventId(selectedEventId);
      });

    const channel = supabase
      .channel(`scores-input-${selectedEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scores",
          filter: `event_id=eq.${selectedEventId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          const s = payload.new as ScoreRow;
          setRows((prev) => ({ ...prev, [s.class_id]: rowFromScore(s) }));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, classes]);

  function updateRow(classId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [classId]: { ...prev[classId], ...patch, error: undefined } }));
  }

  async function saveDraft(classId: string) {
    if (!selectedEvent) return;
    const row = rows[classId];
    if (!row) return;

    if (selectedEvent.scoring_type === "direct") {
      const v = row.direct;
      if (v != null && (v < 0 || v > selectedEvent.max_points)) {
        updateRow(classId, { error: `0~${selectedEvent.max_points}점 범위로 입력하세요.` });
        return;
      }
    }
    if (selectedEvent.scoring_type === "rank" && row.rank != null && row.rank < 1) {
      updateRow(classId, { error: "1 이상의 순위를 입력하세요." });
      return;
    }

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
          status: "draft",
        },
        { onConflict: "event_id,class_id" },
      )
      .select()
      .single();

    if (error) {
      updateRow(classId, { saving: false, error: "저장 실패: " + error.message });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: rowFromScore(data as ScoreRow) }));
  }

  async function confirmFinal(classId: string) {
    if (!selectedEvent) return;
    const row = rows[classId];
    if (!row) return;

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
          status: "final",
        },
        { onConflict: "event_id,class_id" },
      )
      .select()
      .single();

    setConfirmTarget(null);
    if (error) {
      updateRow(classId, { saving: false, error: "제출 실패: " + error.message });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: rowFromScore(data as ScoreRow) }));
  }

  async function confirmUnlock(classId: string) {
    const row = rows[classId];
    if (!row?.scoreId) {
      setConfirmTarget(null);
      return;
    }
    updateRow(classId, { saving: true });
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scores")
      .update({ status: "draft" })
      .eq("id", row.scoreId)
      .select()
      .single();

    setConfirmTarget(null);
    if (error) {
      updateRow(classId, { saving: false, error: "수정 전환 실패: " + error.message });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: rowFromScore(data as ScoreRow) }));
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        아직 배정된 종목이 없습니다. 관리자(체육부장) 선생님께 종목 배정을 요청하세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">점수 입력</h1>
        <p className="mt-1 text-sm text-slate-500">
          담당 종목을 선택하고 반별 결과를 입력하세요. 저장 후 &ldquo;최종 제출&rdquo;을 눌러야
          결과 화면에 반영됩니다.
        </p>
      </div>

      <div className="space-y-3">
        {CATEGORY_ORDER.map((cat) => {
          const list = grouped.get(cat) ?? [];
          if (list.length === 0) return null;
          return (
            <div key={cat}>
              <p className="mb-1.5 text-xs font-semibold text-slate-400">{CATEGORY_LABEL[cat]}</p>
              <div className="flex flex-wrap gap-2">
                {list.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                      ev.id === selectedEventId
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                    }`}
                  >
                    {ev.name}
                    {ev.is_locked && " 🔒"}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedEvent && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="font-bold text-slate-900">{selectedEvent.name}</h2>
              <p className="text-xs text-slate-500">
                {CATEGORY_LABEL[selectedEvent.category]} ·{" "}
                {selectedEvent.scoring_type === "rank" && "순위 입력 (배점표 자동 적용)"}
                {selectedEvent.scoring_type === "pass_fail" &&
                  `통과/실패 (통과 시 ${selectedEvent.pass_points}점)`}
                {selectedEvent.scoring_type === "direct" &&
                  `직접 입력 (0~${selectedEvent.max_points}점)`}
              </p>
            </div>
            {selectedEvent.is_locked && (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                관리자에 의해 잠김 — 수정 불가
              </span>
            )}
          </div>

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
                    const disabled =
                      row.status === "final" || selectedEvent.is_locked || row.saving;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm"
                      >
                        <span className="w-20 shrink-0 font-medium text-slate-700">
                          {classLabel(c)}
                        </span>

                        <div className="flex flex-1 items-center gap-2">
                          {selectedEvent.scoring_type === "rank" && (
                            <input
                              type="number"
                              min={1}
                              placeholder="순위"
                              disabled={disabled}
                              value={row.rank ?? ""}
                              onChange={(e) =>
                                updateRow(c.id, {
                                  rank: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          )}

                          {selectedEvent.scoring_type === "pass_fail" && (
                            <div className="flex gap-1.5">
                              <button
                                disabled={disabled}
                                onClick={() => updateRow(c.id, { pass: true })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                                  row.pass === true
                                    ? "border-green-600 bg-green-50 text-green-700"
                                    : "border-slate-200 text-slate-500"
                                }`}
                              >
                                통과
                              </button>
                              <button
                                disabled={disabled}
                                onClick={() => updateRow(c.id, { pass: false })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
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
                              placeholder={`0~${selectedEvent.max_points}`}
                              disabled={disabled}
                              value={row.direct ?? ""}
                              onChange={(e) =>
                                updateRow(c.id, {
                                  direct: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                              className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50 disabled:text-slate-400"
                            />
                          )}

                          <span className="text-xs text-slate-400">
                            {previewPoints(selectedEvent, row).toFixed(0)}점
                          </span>
                        </div>

                        {row.error && <span className="text-xs text-red-600">{row.error}</span>}

                        <div className="flex shrink-0 items-center gap-2">
                          {row.status === "final" ? (
                            <>
                              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                                최종 제출 완료
                              </span>
                              {!selectedEvent.is_locked && (
                                <button
                                  onClick={() => setConfirmTarget({ classId: c.id, type: "unlock" })}
                                  className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                                >
                                  수정하기
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              {row.status === "draft" && (
                                <span className="text-xs text-amber-600">임시저장됨</span>
                              )}
                              <button
                                disabled={disabled}
                                onClick={() => saveDraft(c.id)}
                                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                              >
                                임시저장
                              </button>
                              <button
                                disabled={disabled}
                                onClick={() => setConfirmTarget({ classId: c.id, type: "final" })}
                                className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                              >
                                최종 제출
                              </button>
                            </>
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

      <ConfirmDialog
        open={confirmTarget?.type === "final"}
        title="최종으로 입력을 하시겠습니까?"
        description="최종 제출하면 결과 화면에 즉시 반영됩니다. 제출 후에도 '수정하기'로 다시 고칠 수 있습니다."
        confirmLabel="최종 제출"
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && confirmFinal(confirmTarget.classId)}
        loading={confirmTarget ? rows[confirmTarget.classId]?.saving : false}
      />

      <ConfirmDialog
        open={confirmTarget?.type === "unlock"}
        title="제출된 점수를 수정하시겠습니까?"
        description="수정 모드로 전환되면 다시 최종 제출하기 전까지 결과 화면 집계에서 제외됩니다."
        confirmLabel="수정하기"
        danger
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => confirmTarget && confirmUnlock(confirmTarget.classId)}
        loading={confirmTarget ? rows[confirmTarget.classId]?.saving : false}
      />

      <p className="text-xs text-slate-400">로그인: {profile.email}</p>
    </div>
  );
}
