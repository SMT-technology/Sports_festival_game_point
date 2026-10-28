"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export function SchoolDangerZone({
  schoolId,
  schoolName,
}: {
  schoolId: string;
  schoolName: string;
}) {
  const router = useRouter();

  const [resetOpen, setResetOpen] = useState(false);
  const [resetLabel, setResetLabel] = useState("");
  const [resetConfirmText, setResetConfirmText] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  function openReset() {
    setResetLabel("");
    setResetConfirmText("");
    setResetError(null);
    setResetDone(false);
    setResetOpen(true);
  }

  async function confirmReset() {
    if (resetConfirmText.trim() !== schoolName) {
      setResetError("학교 이름을 정확히 입력해야 진행할 수 있어요.");
      return;
    }
    setResetBusy(true);
    setResetError(null);
    try {
      const res = await fetch(`/api/super/schools/${schoolId}/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: resetLabel }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setResetError(body?.error ?? "초기화에 실패했습니다.");
        return;
      }
      setResetDone(true);
      router.refresh();
    } catch {
      setResetError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setResetBusy(false);
    }
  }

  function openDelete() {
    setDeleteConfirmText("");
    setDeleteError(null);
    setDeleteOpen(true);
  }

  async function confirmDelete() {
    if (deleteConfirmText.trim() !== schoolName) {
      setDeleteError("학교 이름을 정확히 입력해야 진행할 수 있어요.");
      return;
    }
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/super/schools/${schoolId}`, { method: "DELETE" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setDeleteError(body?.error ?? "삭제에 실패했습니다.");
        return;
      }
      router.push("/super/schools");
      router.refresh();
    } catch {
      setDeleteError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-red-200 bg-red-50/40 p-5">
      <h3 className="text-sm font-semibold text-red-800">⚠️ 위험 구역</h3>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
          <div>
            <p className="text-sm font-medium text-slate-800">올해 데이터 보관 후 초기화</p>
            <p className="text-xs text-slate-500">
              지금까지의 반/종목/점수/응원점수를 기록으로 저장해두고 비워서, 다음 체육대회를
              같은 로그인 링크·계정으로 새로 시작할 수 있게 해요.
            </p>
          </div>
          <button
            type="button"
            onClick={openReset}
            className="shrink-0 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-100"
          >
            📦 보관 후 초기화
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3">
          <div>
            <p className="text-sm font-medium text-slate-800">학교 삭제</p>
            <p className="text-xs text-slate-500">
              이 학교의 모든 데이터와 관리자·교사 계정이 영구적으로 삭제돼요. 되돌릴 수 없어요.
            </p>
          </div>
          <button
            type="button"
            onClick={openDelete}
            className="shrink-0 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
          >
            🗑 학교 삭제
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={resetOpen}
        title="올해 데이터 보관 후 초기화"
        description={
          resetDone ? (
            <p className="text-emerald-700">
              보관 완료! 반/종목/점수/응원점수가 초기화됐어요. 관리자가 새로 반/종목을
              만들면 돼요.
            </p>
          ) : (
            <div className="space-y-3">
              <p>
                지금까지의 데이터가 기록으로 저장된 뒤, 반/종목/점수/응원점수가 전부
                비워져요. 로그인 링크와 관리자·교사 계정, 사이트 설정은 그대로 남아요.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  보관 이름 (선택, 예: 2026년 체육대회)
                </label>
                <input
                  value={resetLabel}
                  onChange={(e) => setResetLabel(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  placeholder="예: 2026년 체육대회"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  진행하려면 학교 이름(&ldquo;{schoolName}&rdquo;)을 정확히 입력하세요
                </label>
                <input
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  placeholder={schoolName}
                />
              </div>
              {resetError && <p className="text-xs text-red-600">{resetError}</p>}
            </div>
          )
        }
        confirmLabel={resetDone ? "닫기" : "보관 후 초기화"}
        danger={!resetDone}
        onCancel={() => setResetOpen(false)}
        onConfirm={resetDone ? () => setResetOpen(false) : confirmReset}
        loading={resetBusy}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="학교 삭제"
        description={
          <div className="space-y-3">
            <p>
              &ldquo;{schoolName}&rdquo;의 모든 반/종목/점수/응원점수/설정과 관리자·교사
              계정이 영구적으로 삭제돼요. 이 작업은 되돌릴 수 없어요.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-500">
                진행하려면 학교 이름(&ldquo;{schoolName}&rdquo;)을 정확히 입력하세요
              </label>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                placeholder={schoolName}
              />
            </div>
            {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}
          </div>
        }
        confirmLabel="영구 삭제"
        danger
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
        loading={deleteBusy}
      />
    </section>
  );
}
