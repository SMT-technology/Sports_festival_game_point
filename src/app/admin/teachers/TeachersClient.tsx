"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DEFAULT_TEACHER_PIN, isValidPin, nameToTeacherEmail } from "@/lib/teacherAuth";

export function TeachersClient({
  currentUserId,
  initialProfiles,
}: {
  currentUserId: string;
  initialProfiles: Profile[];
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetBusyId, setResetBusyId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [nameSavingId, setNameSavingId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<Record<string, string>>({});
  const [form, setForm] = useState({ name: "" });
  const [formError, setFormError] = useState<string | null>(null);

  async function createTeacher() {
    setFormError(null);
    if (!form.name.trim()) {
      setFormError("이름을 입력하세요.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/admin/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setFormError(body.error ?? "계정 생성에 실패했습니다.");
      return;
    }
    setProfiles((prev) => [
      ...prev,
      {
        id: body.id,
        email: nameToTeacherEmail(form.name),
        name: form.name.trim(),
        role: "teacher",
        must_change_password: true,
        created_at: new Date().toISOString(),
      },
    ]);
    setForm({ name: "" });
  }

  async function toggleRole(p: Profile) {
    const nextRole = p.role === "admin" ? "teacher" : "admin";
    if (
      !confirm(
        `${p.name} 님을 ${nextRole === "admin" ? "관리자로 승격" : "교사로 강등"}하시겠습니까?`,
      )
    )
      return;
    const supabase = createClient();
    const { error } = await supabase.from("profiles").update({ role: nextRole }).eq("id", p.id);
    if (error) {
      alert("권한 변경 실패: " + error.message);
      return;
    }
    setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, role: nextRole } : x)));
  }

  async function resetPassword(p: Profile) {
    const pin = prompt(
      `${p.name} 님에게 새로 발급할 임시 비밀번호(숫자 4자리)를 입력하세요`,
      DEFAULT_TEACHER_PIN,
    );
    if (pin === null) return;
    if (!isValidPin(pin)) {
      alert("비밀번호는 숫자 4자리로 입력해주세요.");
      return;
    }
    setResetBusyId(p.id);
    const res = await fetch(`/api/admin/teachers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    const body = await res.json();
    setResetBusyId(null);
    if (!res.ok) alert("변경 실패: " + body.error);
    else alert(`임시 비밀번호(${pin})로 초기화되었습니다. 다음 로그인 시 본인이 새로 설정해야 합니다.`);
  }

  async function saveName(p: Profile) {
    const draft = (nameDrafts[p.id] ?? p.name).trim();
    if (!draft || draft === p.name) return;
    setNameSavingId(p.id);
    setNameError((prev) => ({ ...prev, [p.id]: "" }));
    const res = await fetch(`/api/admin/teachers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: draft }),
    });
    const body = await res.json();
    setNameSavingId(null);
    if (!res.ok) {
      setNameError((prev) => ({ ...prev, [p.id]: body.error ?? "이름 변경 실패" }));
      return;
    }
    setProfiles((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? { ...x, name: draft, email: x.role === "teacher" ? nameToTeacherEmail(draft) : x.email }
          : x,
      ),
    );
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[p.id];
      return next;
    });
  }

  async function deleteTeacher() {
    if (!deleteTarget) return;
    setBusy(true);
    const res = await fetch(`/api/admin/teachers/${deleteTarget.id}`, { method: "DELETE" });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      alert("삭제 실패: " + body.error);
      return;
    }
    setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">👩‍🏫 교사 계정 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          계정을 만들면 별도 배정 없이 모든 학년·종목에 바로 점수를 입력할 수 있어요. 교사
          로그인은 이메일이 아니라 <b>성함 + 4자리 비밀번호</b>로 이뤄져요. 이름만 입력하면
          초기 비밀번호 <b>{DEFAULT_TEACHER_PIN}</b>으로 계정이 만들어지고, 교사가 최초
          로그인하면 본인이 직접 새 4자리 비밀번호로 바꿔야 합니다. 이름이 같은 교사가 이미
          있으면 &ldquo;김민수(2반)&rdquo;처럼 구분해서 등록해주세요.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">새 교사 계정 추가</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500">이름</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ name: e.target.value })}
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="예: 김민수"
            />
          </div>
          <button
            onClick={createTeacher}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            계정 생성 (초기 비밀번호 {DEFAULT_TEACHER_PIN})
          </button>
        </div>
        {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-400">
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">로그인 방식</th>
              <th className="px-4 py-2">권한</th>
              <th className="px-4 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const draft = nameDrafts[p.id] ?? p.name;
              const changed = draft.trim() !== p.name && draft.trim() !== "";
              return (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <input
                      value={draft}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({ ...prev, [p.id]: e.target.value }))
                      }
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm font-medium text-slate-800"
                    />
                    {changed && (
                      <button
                        onClick={() => saveName(p)}
                        disabled={nameSavingId === p.id}
                        className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        저장
                      </button>
                    )}
                  </div>
                  {nameError[p.id] && (
                    <p className="mt-1 text-xs text-red-600">{nameError[p.id]}</p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {p.role === "admin" ? p.email : "성함 + 4자리 비밀번호"}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      p.role === "admin"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {p.role === "admin" ? "관리자" : "교사"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-2">
                    {p.id === currentUserId ? (
                      <span className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1 text-xs text-slate-400">
                        본인 계정 (여기서 변경 불가)
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() => toggleRole(p)}
                          title={
                            p.role === "teacher"
                              ? "주의: 성함+비밀번호로 만든 교사 계정은 실제 이메일을 모르므로, 승격해도 이메일로 로그인할 수 없어요."
                              : undefined
                          }
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {p.role === "admin" ? "교사로 변경" : "관리자로 승격"}
                        </button>
                        {p.role === "teacher" && (
                          <button
                            onClick={() => resetPassword(p)}
                            disabled={resetBusyId === p.id}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                          >
                            🔄 비밀번호 초기화
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                          삭제
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`'${deleteTarget?.name}' 계정을 삭제하시겠습니까?`}
        description="계정이 영구 삭제됩니다. 이 교사가 입력한 점수 기록은 유지됩니다."
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteTeacher}
        loading={busy}
      />
    </div>
  );
}
