"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassRow } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const ALL_GRADES = [1, 2, 3] as const;

const GRADE_STYLE: Record<number, { border: string; header: string; badge: string }> = {
  1: { border: "border-blue-400", header: "bg-blue-50", badge: "bg-blue-600 text-white" },
  2: { border: "border-purple-400", header: "bg-purple-50", badge: "bg-purple-600 text-white" },
  3: { border: "border-green-400", header: "bg-green-50", badge: "bg-green-600 text-white" },
};

export function ClassesClient({
  initialClasses,
  initialActiveGrades,
  schoolId,
}: {
  initialClasses: ClassRow[];
  initialActiveGrades: (1 | 2 | 3)[];
  schoolId: string;
}) {
  const [tab, setTab] = useState<"classes" | "grades">("classes");
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses);
  const [busyGrade, setBusyGrade] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllGrade, setDeleteAllGrade] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeGrades, setActiveGrades] = useState<(1 | 2 | 3)[]>(initialActiveGrades);
  const [gradeBusy, setGradeBusy] = useState<number | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const g of ALL_GRADES) map.set(g, []);
    for (const c of classes) map.get(c.grade)?.push(c);
    for (const list of map.values()) list.sort((a, b) => a.class_no - b.class_no);
    return map;
  }, [classes]);

  const sortedActiveGrades = useMemo(
    () => [...activeGrades].sort((a, b) => a - b),
    [activeGrades],
  );

  async function addClass(grade: 1 | 2 | 3) {
    setError(null);
    setBusyGrade(grade);
    const list = classesByGrade.get(grade) ?? [];
    const nextNo = list.length ? Math.max(...list.map((c) => c.class_no)) + 1 : 1;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("classes")
      .insert({ grade, class_no: nextNo })
      .select()
      .single();
    setBusyGrade(null);
    if (error) {
      setError("반 추가 실패: " + error.message);
      return;
    }
    setClasses((prev) => [...prev, data as ClassRow]);
  }

  async function deleteClass() {
    if (!deleteTarget) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("id", deleteTarget.id);
    setDeleting(false);
    if (error) {
      setError("삭제 실패: " + error.message);
      setDeleteTarget(null);
      return;
    }
    setClasses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  async function deleteAllInGrade() {
    if (deleteAllGrade === null) return;
    setDeletingAll(true);
    const supabase = createClient();
    const { error } = await supabase.from("classes").delete().eq("grade", deleteAllGrade);
    setDeletingAll(false);
    if (error) {
      setError("모두 삭제 실패: " + error.message);
      setDeleteAllGrade(null);
      return;
    }
    setClasses((prev) => prev.filter((c) => c.grade !== deleteAllGrade));
    setDeleteAllGrade(null);
  }

  async function toggleGrade(grade: 1 | 2 | 3) {
    setGradeError(null);
    const isActive = activeGrades.includes(grade);

    if (isActive) {
      if (activeGrades.length <= 1) {
        setGradeError("최소 1개 학년은 사용 중이어야 해요.");
        return;
      }
      if ((classesByGrade.get(grade)?.length ?? 0) > 0) {
        setGradeError(
          `${grade}학년을 끄려면 먼저 "반 관리" 탭에서 ${grade}학년 반을 모두 삭제하세요.`,
        );
        return;
      }
    }

    const next = isActive
      ? activeGrades.filter((g) => g !== grade)
      : [...activeGrades, grade].sort((a, b) => a - b);

    setGradeBusy(grade);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({ active_grades: next })
      .eq("school_id", schoolId);
    setGradeBusy(null);
    if (error) {
      setGradeError("저장 실패: " + error.message);
      return;
    }
    setActiveGrades(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">🏫 반 관리</h1>
      </div>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setTab("classes")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "classes" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
          }`}
        >
          🏫 반 관리
        </button>
        <button
          type="button"
          onClick={() => setTab("grades")}
          className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
            tab === "grades" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
          }`}
        >
          🎓 학년 관리
        </button>
      </div>

      {tab === "classes" ? (
        <div className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {sortedActiveGrades.map((grade) => {
            const style = GRADE_STYLE[grade];
            const list = classesByGrade.get(grade) ?? [];
            return (
              <div
                key={grade}
                className={`overflow-hidden rounded-xl border-l-4 ${style.border} border border-slate-200 bg-white`}
              >
                <div className={`flex items-center justify-between gap-2 px-5 py-2 ${style.header}`}>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                    {grade}학년 ({list.length}개 반)
                  </span>
                  <div className="flex gap-1.5">
                    {list.length > 0 && (
                      <button
                        onClick={() => setDeleteAllGrade(grade)}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
                      >
                        🗑 모두 삭제
                      </button>
                    )}
                    <button
                      onClick={() => addClass(grade)}
                      disabled={busyGrade === grade}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      + 반 추가
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 p-4">
                  {list.length === 0 && (
                    <p className="text-sm text-slate-400">등록된 반이 없습니다.</p>
                  )}
                  {list.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1.5 text-sm text-slate-700"
                    >
                      {c.class_no}반
                      <button
                        onClick={() => setDeleteTarget(c)}
                        title="삭제"
                        className="rounded-full px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-100"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {gradeError && <p className="text-sm text-red-600">{gradeError}</p>}
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {ALL_GRADES.map((grade) => {
              const isActive = activeGrades.includes(grade);
              return (
                <div key={grade} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-sm font-medium text-slate-800">
                    {grade}학년
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      반 {classesByGrade.get(grade)?.length ?? 0}개
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleGrade(grade)}
                    disabled={gradeBusy === grade}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
                      isActive
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {isActive ? "사용 중 · 끄기" : "사용 안 함 · 켜기"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`${deleteTarget?.grade}학년 ${deleteTarget?.class_no}반을 삭제하시겠습니까?`}
        description="이 반의 모든 점수 기록과 응원 점수 지급 기록이 함께 영구 삭제됩니다. 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteClass}
        loading={deleting}
      />

      <ConfirmDialog
        open={deleteAllGrade !== null}
        title={`${deleteAllGrade}학년 반을 모두 삭제하시겠습니까?`}
        description={`${deleteAllGrade}학년의 반 ${
          classesByGrade.get(deleteAllGrade ?? -1)?.length ?? 0
        }개와 그 반들의 모든 점수·응원 점수 기록이 함께 영구 삭제됩니다. 되돌릴 수 없습니다.`}
        confirmLabel="모두 삭제"
        danger
        onCancel={() => setDeleteAllGrade(null)}
        onConfirm={deleteAllInGrade}
        loading={deletingAll}
      />
    </div>
  );
}
