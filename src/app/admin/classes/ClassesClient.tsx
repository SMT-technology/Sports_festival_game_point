"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ClassRow } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const GRADES = [1, 2, 3] as const;

const GRADE_STYLE: Record<number, { border: string; header: string; badge: string }> = {
  1: { border: "border-blue-400", header: "bg-blue-50", badge: "bg-blue-600 text-white" },
  2: { border: "border-purple-400", header: "bg-purple-50", badge: "bg-purple-600 text-white" },
  3: { border: "border-green-400", header: "bg-green-50", badge: "bg-green-600 text-white" },
};

export function ClassesClient({ initialClasses }: { initialClasses: ClassRow[] }) {
  const [classes, setClasses] = useState<ClassRow[]>(initialClasses);
  const [busyGrade, setBusyGrade] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClassRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const g of GRADES) map.set(g, []);
    for (const c of classes) map.get(c.grade)?.push(c);
    for (const list of map.values()) list.sort((a, b) => a.class_no - b.class_no);
    return map;
  }, [classes]);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">🏫 반 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          학년별로 반을 추가/삭제할 수 있어요. &ldquo;+ 반 추가&rdquo;를 누르면 그 학년의
          가장 큰 반 번호 다음 번호로 새 반이 만들어집니다. 반을 삭제하면 기존 번호가 자동으로
          당겨지지 않으니(다른 반의 번호·데이터가 바뀌지 않도록), 번호에 빈 칸이 생길 수
          있어요 — 정상입니다.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          ⚠️ 반을 삭제하면 그 반이 입력했던 모든 점수와 응원 점수 기록도 함께 영구 삭제됩니다.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-4">
        {GRADES.map((grade) => {
          const style = GRADE_STYLE[grade];
          const list = classesByGrade.get(grade) ?? [];
          return (
            <div key={grade} className={`overflow-hidden rounded-xl border-l-4 ${style.border} border border-slate-200 bg-white`}>
              <div className={`flex items-center justify-between gap-2 px-5 py-2 ${style.header}`}>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                  {grade}학년 ({list.length}개 반)
                </span>
                <button
                  onClick={() => addClass(grade)}
                  disabled={busyGrade === grade}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  + 반 추가
                </button>
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {list.length === 0 && <p className="text-sm text-slate-400">등록된 반이 없습니다.</p>}
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
    </div>
  );
}
