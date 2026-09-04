"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
}: {
  profile: Profile;
  events: EventRow[];
  classes: ClassRow[];
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

  const availableGrades = useMemo(
    () => [...new Set(classes.map((c) => c.grade))].sort() as (1 | 2 | 3)[],
    [classes],
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const grouped = useMemo(() => {
    const map = new Map<EventCategory, EventRow[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const ev of events) map.get(ev.category)?.push(ev);
    for (const list of map.values()) list.sort((a, b) => a.order_index - b.order_index);
    return map;
  }, [events]);

  // "반대항전" 종목을 장소 기준으로 운동장/체육관 두 그룹으로 나눠서 보여준다
  // (실제 카테고리는 여전히 relay 하나지만, 화면에서만 앞 절반/뒤 절반으로 분리)
  const displayGroups = useMemo(() => {
    const relayList = grouped.get("relay") ?? [];
    const half = Math.ceil(relayList.length / 2);
    return [
      {
        key: "field",
        label: "운동장",
        emoji: "🏟️",
        gradient: "from-red-500 to-orange-500",
        events: relayList.slice(0, half),
      },
      {
        key: "gym",
        label: "체육관",
        emoji: "🏸",
        gradient: "from-sky-500 to-blue-600",
        events: relayList.slice(half),
      },
      {
        key: "minigame",
        label: "신관",
        emoji: "🎮",
        gradient: "from-fuchsia-500 to-purple-600",
        events: grouped.get("minigame") ?? [],
      },
      {
        key: "cheer",
        label: CATEGORY_LABEL.cheer,
        emoji: "📣",
        gradient: "from-amber-400 to-yellow-500",
        events: grouped.get("cheer") ?? [],
      },
    ];
  }, [grouped]);

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
    return false;
  }

  const readyToFinalize = useMemo(
    () => gradeClasses.filter((c) => rows[c.id] && rows[c.id].status !== "final" && hasValue(rows[c.id])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradeClasses, rows, selectedEvent],
  );

  async function saveDraft(classId: string) {
    if (!selectedEvent) return;
    const row = rows[classId];
    if (!row) return;

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
        아직 등록된 종목이 없습니다. 관리자(서민택 선생님)께 문의하세요.
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
            {displayGroups.map((group) => {
              if (group.events.length === 0) return null;
              return (
                <div key={group.key}>
                  <p className="mb-2 text-base font-extrabold text-slate-700">
                    {group.emoji} {group.label}
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
                  {CATEGORY_LABEL[selectedEvent.category]} ·{" "}
                  {selectedEvent.scoring_type === "rank" && "순위 입력 (배점표 자동 적용)"}
                  {selectedEvent.scoring_type === "pass_fail" &&
                    `통과/실패 (통과 시 ${selectedEvent.pass_points}점)`}
                  {selectedEvent.scoring_type === "direct" &&
                    `직접 입력 (0~${selectedEvent.max_points}점)`}
                </p>
              </div>
              <button
                onClick={() => setBulkConfirmOpen(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                ✅ 전체 최종 제출{readyToFinalize.length > 0 && ` (${readyToFinalize.length}개 반)`}
              </button>
            </div>

            {bulkError && (
              <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-600">
                {bulkError}
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
                            <span className="text-xs text-slate-400">
                              수정하려면 관리자에게 문의하세요
                            </span>
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
                          </>
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
            <span className="block text-base font-extrabold text-red-600">
              ‼️ 주의 ‼️ : 제출 시 수정 불가
            </span>
            <span className="mt-0.5 block text-xs text-slate-500">
              관리자 (서민택)에게 연락!!
            </span>
            <span className="mt-3 block">
              입력된 {readyToFinalize.length}개 반의 점수를 한 번에 최종 제출합니다. 결과 화면에
              즉시 반영됩니다.
            </span>
          </>
        }
        confirmLabel="전체 최종 제출"
        onCancel={() => setBulkConfirmOpen(false)}
        onConfirm={finalizeAll}
        loading={bulkSaving}
      />

      <p className="text-xs text-slate-400">로그인: {profile.email}</p>
    </div>
  );
}
