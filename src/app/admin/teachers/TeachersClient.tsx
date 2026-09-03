"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

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
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  async function createTeacher() {
    setFormError(null);
    if (!form.name || !form.email || !form.password) {
      setFormError("모든 항목을 입력하세요.");
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
        email: form.email,
        name: form.name,
        role: "teacher",
        created_at: new Date().toISOString(),
      },
    ]);
    setForm({ name: "", email: "", password: "" });
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
    const password = prompt(`${p.name} 님의 새 비밀번호를 입력하세요 (6자 이상)`);
    if (!password) return;
    const res = await fetch(`/api/admin/teachers/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json();
    if (!res.ok) alert("변경 실패: " + body.error);
    else alert("비밀번호가 변경되었습니다.");
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
          계정을 만들면 별도 배정 없이 모든 학년·종목에 바로 점수를 입력할 수 있어요.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">새 교사 계정 추가</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500">이름</label>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-32 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">이메일</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
              className="mt-1 w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">초기 비밀번호</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
              className="mt-1 w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="6자 이상"
            />
          </div>
          <button
            onClick={createTeacher}
            disabled={busy}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            계정 생성
          </button>
        </div>
        {formError && <p className="mt-2 text-xs text-red-600">{formError}</p>}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-400">
              <th className="px-4 py-2">이름</th>
              <th className="px-4 py-2">이메일</th>
              <th className="px-4 py-2">권한</th>
              <th className="px-4 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => (
              <tr key={p.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2.5 text-slate-500">{p.email}</td>
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
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          {p.role === "admin" ? "교사로 변경" : "관리자로 승격"}
                        </button>
                        <button
                          onClick={() => resetPassword(p)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                        >
                          비밀번호 재설정
                        </button>
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
            ))}
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
