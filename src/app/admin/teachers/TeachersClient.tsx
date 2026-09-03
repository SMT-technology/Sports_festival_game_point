"use client";

import { Fragment, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type { EventAssignment, EventCategory, EventRow, Profile } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CATEGORY_ORDER: EventCategory[] = ["relay", "minigame", "cheer"];

export function TeachersClient({
  currentUserId,
  initialProfiles,
  events,
  initialAssignments,
}: {
  currentUserId: string;
  initialProfiles: Profile[];
  events: EventRow[];
  initialAssignments: EventAssignment[];
}) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [assignments, setAssignments] = useState<EventAssignment[]>(initialAssignments);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [formError, setFormError] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<EventCategory, EventRow[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const ev of events) map.get(ev.category)?.push(ev);
    return map;
  }, [events]);

  const assignedSet = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const a of assignments) {
      if (!map.has(a.teacher_id)) map.set(a.teacher_id, new Set());
      map.get(a.teacher_id)!.add(a.event_id);
    }
    return map;
  }, [assignments]);

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
      { id: body.id, email: form.email, name: form.name, role: "teacher", created_at: new Date().toISOString() },
    ]);
    setForm({ name: "", email: "", password: "" });
  }

  async function toggleRole(p: Profile) {
    const nextRole = p.role === "admin" ? "teacher" : "admin";
    if (!confirm(`${p.name} 님을 ${nextRole === "admin" ? "관리자로 승격" : "교사로 강등"}하시겠습니까?`)) return;
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

  async function toggleAssignment(teacherId: string, eventId: string, assigned: boolean) {
    const supabase = createClient();
    if (assigned) {
      const { error } = await supabase
        .from("event_assignments")
        .delete()
        .eq("teacher_id", teacherId)
        .eq("event_id", eventId);
      if (error) return alert("배정 해제 실패: " + error.message);
      setAssignments((prev) => prev.filter((a) => !(a.teacher_id === teacherId && a.event_id === eventId)));
    } else {
      const { data, error } = await supabase
        .from("event_assignments")
        .insert({ teacher_id: teacherId, event_id: eventId })
        .select()
        .single();
      if (error) return alert("배정 실패: " + error.message);
      setAssignments((prev) => [...prev, data as EventAssignment]);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">교사 계정 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          계정을 생성하고, 각 교사가 입력할 수 있는 종목(스테이션)을 배정하세요.
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
              <th className="px-4 py-2">배정 종목</th>
              <th className="px-4 py-2 text-right">관리</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((p) => {
              const myAssigned = assignedSet.get(p.id) ?? new Set<string>();
              const isOpen = expandedId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className="border-b border-slate-50">
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
                    <td className="px-4 py-2.5 text-slate-500">
                      {p.role === "admin" ? (
                        "전체"
                      ) : (
                        <button
                          onClick={() => setExpandedId(isOpen ? null : p.id)}
                          className="underline decoration-dotted underline-offset-2"
                        >
                          {myAssigned.size}개 배정됨
                        </button>
                      )}
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
                  {isOpen && p.role !== "admin" && (
                    <tr className="border-b border-slate-50 bg-slate-50/60">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="space-y-2">
                          {CATEGORY_ORDER.map((cat) => (
                            <div key={cat}>
                              <p className="mb-1 text-xs font-semibold text-slate-400">
                                {CATEGORY_LABEL[cat]}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(grouped.get(cat) ?? []).map((ev) => {
                                  const assigned = myAssigned.has(ev.id);
                                  return (
                                    <button
                                      key={ev.id}
                                      onClick={() => toggleAssignment(p.id, ev.id, assigned)}
                                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                                        assigned
                                          ? "border-blue-600 bg-blue-600 text-white"
                                          : "border-slate-200 bg-white text-slate-500"
                                      }`}
                                    >
                                      {ev.name}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`'${deleteTarget?.name}' 계정을 삭제하시겠습니까?`}
        description="계정과 배정 정보가 영구 삭제됩니다. 이 교사가 입력한 점수 기록은 유지됩니다."
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteTeacher}
        loading={busy}
      />
    </div>
  );
}
