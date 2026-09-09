"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  submittedBy: string | null;
  saving?: boolean;
  error?: string;
}

function emptyRow(): RowState {
  return { rank: null, pass: null, direct: null, tier: null, status: "empty", submittedBy: null };
}

function rowFromScore(score: ScoreRow): RowState {
  return {
    scoreId: score.id,
    rank: score.rank_value,
    pass: score.pass_value,
    direct: score.direct_value,
    tier: score.tier_index,
    status: score.status,
    submittedBy: score.submitted_by,
  };
}

// 학년별 체육복 색상
const GRADE_UNIFORM: Record<number, string> = {
  1: "fill-blue-600",
  2: "fill-purple-600",
  3: "fill-green-600",
};

function ShirtGraphic({ fillClass, label }: { fillClass: string; label: string }) {
  return (
    <svg viewBox="0 0 100 100" className="mx-auto h-28 w-28 drop-shadow-md" aria-hidden>
      {/* 체육복 몸통 + 소매 */}
      <path
        d="M30,15 C38,24 62,24 70,15 L92,28 L78,40 L78,88 L22,88 L22,40 L8,28 Z"
        className={fillClass}
      />
      {/* 깃 (카라) 라인 */}
      <path
        d="M33,17 C40,24 60,24 67,17"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* 소매 밑단 */}
      <line x1="92" y1="28" x2="78" y2="40" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <line x1="8" y1="28" x2="22" y2="40" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      {/* 옆선 */}
      <line x1="78" y1="40" x2="78" y2="88" stroke="black" strokeOpacity="0.15" strokeWidth="1.5" />
      <line x1="22" y1="40" x2="22" y2="88" stroke="black" strokeOpacity="0.15" strokeWidth="1.5" />
      {/* 등번호 */}
      <text
        x="50"
        y="70"
        textAnchor="middle"
        fontSize="34"
        fontWeight="800"
        fill="white"
        opacity="0.95"
      >
        {label}
      </text>
    </svg>
  );
}

function BackButton({ onClick, label = "← 뒤로" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

type Step = "grade" | "event" | "score";

export function InputClient({
  profile,
  events,
  classes,
  locations,
}: {
  profile: Profile;
  events: EventRow[];
  classes: ClassRow[];
  locations: EventLocation[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("grade");
  const [selectedGrade, setSelectedGrade] = useState<1 | 2 | 3 | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loadedEventId, setLoadedEventId] = useState<string | null>(null);
  const loading = selectedEventId !== null && loadedEventId !== selectedEventId;
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);
  const [bulkCancelSaving, setBulkCancelSaving] = useState(false);
  const [bulkCancelError, setBulkCancelError] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<ClassRow | null>(null);
  const [historyLogs, setHistoryLogs] = useState<ScoreAuditLog[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  const availableGrades = useMemo(
    () => [...new Set(classes.map((c) => c.grade))].sort() as (1 | 2 | 3)[],
    [classes],
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  // 장소(분류)는 관리자가 자유롭게 추가할 수 있으므로, 고정된 3개가 아니라
  // event_locations 목록 순서대로 동적으로 묶어서 보여준다. 응원 추가 점수는
  // 별도 종목이 아니라, 각 종목의 점수 입력 화면에서 반별로 함께 입력한다.
  const displayGroups = useMemo(() => {
    const eventsForGrade = selectedGrade
      ? events.filter((ev) => ev.grades.includes(selectedGrade))
      : events;
    return groupEventsByLocation(eventsForGrade, locations).map((group, i) => ({
      ...group,
      gradient: locationStyle(i).gradient,
    }));
  }, [events, selectedGrade, locations]);

  const gradeClasses = useMemo(
    () =>
      selectedGrade
        ? classes.filter((c) => c.grade === selectedGrade).sort((a, b) => a.class_no - b.class_no)
        : [],
    [classes, selectedGrade],
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
          if (payload.eventType === "DELETE") {
            // 삭제(제출 취소) 이벤트의 payload.old는 기본적으로 id만 들어있어서
            // class_id로 바로 찾을 수 없다 — 대신 로컬 상태에서 같은 scoreId를
            // 가진 반을 찾아 빈 상태로 되돌린다. (다른 선생님이 같은 화면을
            // 보고 있을 때, 취소된 반이 바로 반영되게 하기 위함)
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
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [selectedEventId, classes]);

  function updateRow(classId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [classId]: { ...prev[classId], ...patch, error: undefined } }));
  }

  function pickGrade(grade: 1 | 2 | 3) {
    setSelectedGrade(grade);
    setStep("event");
  }

  function pickEvent(eventId: string) {
    setSelectedEventId(eventId);
    setStep("score");
  }

  function validateRow(row: RowState): string | null {
    if (!selectedEvent) return null;
    if (selectedEvent.scoring_type === "direct") {
      const v = row.direct;
      if (v != null && (v < 0 || v > selectedEvent.max_points)) {
        return `0~${selectedEvent.max_points}점 범위로 입력하세요.`;
      }
    }
    if (selectedEvent.scoring_type === "rank" && row.rank != null && row.rank < 1) {
      return "1 이상의 순위를 입력하세요.";
    }
    return null;
  }

  function hasValue(row: RowState): boolean {
    if (!selectedEvent) return false;
    if (selectedEvent.scoring_type === "rank") return row.rank != null;
    if (selectedEvent.scoring_type === "pass_fail") return row.pass != null;
    if (selectedEvent.scoring_type === "direct") return row.direct != null;
    if (selectedEvent.scoring_type === "tier") return row.tier != null;
    return false;
  }

  const readyToFinalize = useMemo(
    () => gradeClasses.filter((c) => rows[c.id] && rows[c.id].status !== "final" && hasValue(rows[c.id])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradeClasses, rows, selectedEvent],
  );

  // 이 화면에서 "전체 제출 취소"로 되돌릴 수 있는 건, 지금 이 학년에서 내가
  // 직접 제출한(submittedBy = 나) 반뿐이다. 다른 교사가 제출한 건 여기서
  // 건드릴 수 없다 (RLS도 동일하게 막혀 있음).
  const myFinalized = useMemo(
    () =>
      gradeClasses.filter(
        (c) => rows[c.id]?.status === "final" && rows[c.id]?.submittedBy === profile.id,
      ),
    [gradeClasses, rows, profile.id],
  );

  async function submitRow(classId: string) {
    if (!selectedEvent) return;
    const row = rows[classId];
    if (!row) return;

    if (!hasValue(row)) {
      updateRow(classId, { error: "점수를 입력하세요." });
      return;
    }
    const err = validateRow(row);
    if (err) {
      updateRow(classId, { error: err });
      return;
    }

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
          status: "final",
        },
        { onConflict: "event_id,class_id" },
      )
      .select()
      .single();

    if (error) {
      updateRow(classId, { saving: false, error: "제출 실패: " + error.message });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: rowFromScore(data as ScoreRow) }));
  }

  async function cancelSubmission(classId: string) {
    const row = rows[classId];
    if (!row?.scoreId) return;
    if (!confirm("제출을 취소할까요? 입력된 점수가 삭제되고, 다시 입력할 수 있게 됩니다.")) return;

    updateRow(classId, { saving: true });
    const supabase = createClient();
    const { error } = await supabase.from("scores").delete().eq("id", row.scoreId);
    if (error) {
      updateRow(classId, { saving: false, error: "취소 실패: " + error.message });
      return;
    }
    setRows((prev) => ({ ...prev, [classId]: emptyRow() }));
  }

  async function cancelAll() {
    if (myFinalized.length === 0) {
      setBulkCancelOpen(false);
      return;
    }
    setBulkCancelError(null);
    setBulkCancelSaving(true);
    const ids = myFinalized.map((c) => rows[c.id].scoreId as string);
    const supabase = createClient();
    const { error } = await supabase.from("scores").delete().in("id", ids);
    setBulkCancelSaving(false);
    setBulkCancelOpen(false);

    if (error) {
      setBulkCancelError("전체 제출 취소 실패: " + error.message);
      return;
    }
    setRows((prev) => {
      const next = { ...prev };
      for (const c of myFinalized) next[c.id] = emptyRow();
      return next;
    });
  }

  async function openHistory(c: ClassRow) {
    if (!selectedEvent) return;
    setHistoryFor(c);
    const supabase = createClient();
    // score_id가 아니라 event_id + class_id 기준으로 조회한다 — 제출 취소로
    // 기존 행이 삭제되고 새 id로 다시 생성돼도 이전 이력이 계속 보이도록.
    const { data } = await supabase
      .from("score_audit_log")
      .select("*")
      .eq("event_id", selectedEvent.id)
      .eq("class_id", c.id)
      .order("changed_at", { ascending: false });
    const logs = (data ?? []) as ScoreAuditLog[];
    setHistoryLogs(logs);

    const ids = [...new Set(logs.map((l) => l.changed_by).filter((x): x is string => !!x))];
    if (ids.length === 0) return;
    const { data: people } = await supabase.from("profiles").select("*").in("id", ids);
    const map: Record<string, Profile> = {};
    for (const p of (people ?? []) as Profile[]) map[p.id] = p;
    setProfilesById((prev) => ({ ...prev, ...map }));
  }

  async function finalizeAll() {
    if (!selectedEvent) return;
    setBulkError(null);

    for (const c of readyToFinalize) {
      const err = validateRow(rows[c.id]);
      if (err) {
        setBulkError(`${classLabel(c)}: ${err}`);
        return;
      }
    }

    if (readyToFinalize.length === 0) {
      setBulkError("입력된 점수가 없습니다. 먼저 반별 점수를 입력해주세요.");
      return;
    }

    setBulkSaving(true);
    const payload = readyToFinalize.map((c) => {
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
    setBulkConfirmOpen(false);

    if (error) {
      setBulkError("전체 최종 제출 실패: " + error.message);
      return;
    }
    setRows((prev) => {
      const next = { ...prev };
      for (const s of (data ?? []) as ScoreRow[]) next[s.class_id] = rowFromScore(s);
      return next;
    });
  }

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        아직 등록된 종목이 없습니다. 관리자에게 문의하세요.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------------- STEP 1: 학년 선택 ---------------- */}
      {step === "grade" && (
        <div className="space-y-6">
          <BackButton onClick={() => router.push("/results")} label="← 결과 화면으로" />
          <div className="text-center">
            <p className="text-3xl">🏟️</p>
            <h1 className="mt-2 text-lg font-bold text-slate-900">어느 학년 점수를 입력할까요?</h1>
            <p className="mt-1 text-sm text-slate-500">학년을 먼저 선택해주세요.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {availableGrades.map((grade) => (
              <button
                key={grade}
                onClick={() => pickGrade(grade)}
                className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
              >
                <ShirtGraphic fillClass={GRADE_UNIFORM[grade]} label={String(grade)} />
                <div className="mt-3 text-xl font-extrabold text-slate-800">{grade}학년</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- STEP 2: 종목 선택 ---------------- */}
      {step === "event" && selectedGrade && (
        <div className="space-y-5">
          <BackButton onClick={() => setStep("grade")} label="← 뒤로 (학년 다시 선택)" />
          <div className="text-center">
            <p className="text-5xl">🏅</p>
            <h1 className="mt-3 text-3xl font-extrabold text-slate-900">
              {selectedGrade}학년 · 어느 종목인가요?
            </h1>
            <p className="mt-1 text-sm text-slate-500">담당 종목을 선택해주세요.</p>
          </div>

          <div className="space-y-6">
            {displayGroups.length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
                {selectedGrade}학년에 배정된 종목이 아직 없습니다. 관리자에게 문의하세요.
              </p>
            )}
            {displayGroups.map((group) => {
              return (
                <div key={group.name}>
                  <p className="mb-2 flex items-center gap-2">
                    <span className="text-3xl">{group.emoji}</span>
                    <span className="text-2xl font-extrabold text-slate-800">{group.name}</span>
                  </p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {group.events.map((ev) => (
                      <button
                        key={ev.id}
                        onClick={() => pickEvent(ev.id)}
                        className={`rounded-2xl bg-gradient-to-br ${group.gradient} px-4 py-6 text-center text-lg font-bold text-white shadow-md transition hover:scale-[1.03] hover:shadow-lg`}
                      >
                        {ev.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------- STEP 3: 점수 입력 ---------------- */}
      {step === "score" && selectedGrade && selectedEvent && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <BackButton onClick={() => setStep("event")} label="← 뒤로 (종목 다시 선택)" />
            <button
              onClick={() => setStep("grade")}
              className="text-xs font-medium text-slate-400 underline decoration-dotted underline-offset-2 hover:text-blue-700"
            >
              학년부터 다시 선택
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="font-bold text-slate-900">
                  {selectedGrade}학년 · {selectedEvent.name}
                </h2>
                <p className="text-xs text-slate-500">
                  {selectedEvent.category} ·{" "}
                  {selectedEvent.scoring_type === "rank" && "순위 입력 (배점표 자동 적용)"}
                  {selectedEvent.scoring_type === "pass_fail" &&
                    `통과/실패 (통과 시 ${selectedEvent.pass_points}점)`}
                  {selectedEvent.scoring_type === "direct" &&
                    `직접 입력 (0~${selectedEvent.max_points}점)`}
                  {selectedEvent.scoring_type === "tier" &&
                    "사용자 설정 점수 (선택한 단계로 자동 반영)"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setBulkConfirmOpen(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                >
                  ✅ 전체 최종 제출{readyToFinalize.length > 0 && ` (${readyToFinalize.length}개 반)`}
                </button>
                <button
                  onClick={() => setBulkCancelOpen(true)}
                  disabled={myFinalized.length === 0}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                >
                  🗑️ 전체 제출 취소{myFinalized.length > 0 && ` (${myFinalized.length}개 반)`}
                </button>
              </div>
            </div>

            {bulkError && (
              <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
                {bulkError}
              </p>
            )}
            {bulkCancelError && (
              <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
                {bulkCancelError}
              </p>
            )}

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">불러오는 중...</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {gradeClasses.map((c) => {
                  const row = rows[c.id] ?? emptyRow();
                  const disabled = row.status === "final" || row.saving;
                  return (
                    <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
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
                                disabled={disabled}
                                onClick={() => updateRow(c.id, { tier: i })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
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
                      </div>

                      {row.error && <span className="text-xs text-red-600">{row.error}</span>}

                      <div className="flex shrink-0 items-center gap-2">
                        {row.status === "final" ? (
                          <>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                              ✅ 최종 제출 완료
                            </span>
                            <button
                              onClick={() => openHistory(c)}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              이력
                            </button>
                            {row.submittedBy === profile.id ? (
                              <button
                                disabled={row.saving}
                                onClick={() => cancelSubmission(c.id)}
                                className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"
                              >
                                🗑️ 제출 취소
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                수정하려면 관리자에게 문의하세요
                              </span>
                            )}
                          </>
                        ) : (
                          <button
                            disabled={row.saving || !hasValue(row)}
                            onClick={() => submitRow(c.id)}
                            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            {row.saving ? "제출 중..." : "제출"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={bulkConfirmOpen}
        title="최종으로 입력을 하시겠습니까?"
        description={
          <>
            <span className="mt-3 block">
              입력된 {readyToFinalize.length}개 반의 점수를 한 번에 최종 제출합니다. 결과 화면에
              즉시 반영됩니다.
            </span>
            <span className="mt-1 block text-xs text-slate-500">
              내가 제출한 건 나중에 &ldquo;제출 취소&rdquo;로 되돌려 다시 입력할 수 있어요.
            </span>
          </>
        }
        confirmLabel="전체 최종 제출"
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={finalizeAll}
        loading={bulkSaving}
      />

      <ConfirmDialog
        open={bulkCancelOpen}
        title="내가 제출한 점수를 전체 취소할까요?"
        description={`이 학년에서 내가 최종 제출한 ${myFinalized.length}개 반의 점수가 모두 삭제되고, 다시 입력할 수 있는 상태로 돌아갑니다. (다른 선생님이 제출한 반은 여기서 취소되지 않습니다)`}
        confirmLabel="전체 제출 취소"
        danger
        onCancel={() => setBulkCancelOpen(false)}
        onConfirm={cancelAll}
        loading={bulkCancelSaving}
      />

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {classLabel(historyFor)} 변경 이력
              </h2>
              <button
                onClick={() => setHistoryFor(null)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {historyLogs.length === 0 && (
                <p className="text-sm text-slate-400">기록이 없습니다.</p>
              )}
              {historyLogs.map((log) => (
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
                    처리자:{" "}
                    {log.changed_by ? (profilesById[log.changed_by]?.name ?? log.changed_by) : "-"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400">로그인: {profile.name}</p>
    </div>
  );
}
