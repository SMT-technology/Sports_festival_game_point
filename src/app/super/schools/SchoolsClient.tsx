"use client";

import { useEffect, useState } from "react";
import type { School } from "@/lib/database.types";

export function SchoolsClient({ initialSchools }: { initialSchools: School[] }) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLoginUrl, setCreatedLoginUrl] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const readOrigin = () => setOrigin(window.location.origin);
    readOrigin();
  }, []);

  async function createSchool() {
    setError(null);
    if (
      !form.name.trim() ||
      !form.slug.trim() ||
      !form.adminName.trim() ||
      !form.adminEmail.trim() ||
      !form.adminPassword
    ) {
      setError("모든 항목을 입력하세요.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/super/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? `학교 생성에 실패했습니다. (서버 오류, status ${res.status})`);
        return;
      }
      setSchools((prev) => [...prev, body.school as School]);
      setCreatedLoginUrl(body.loginUrl as string);
      setForm({ name: "", slug: "", adminName: "", adminEmail: "", adminPassword: "" });
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLoginUrl() {
    if (!createdLoginUrl) return;
    await navigator.clipboard.writeText(`${origin}${createdLoginUrl}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-base font-bold text-slate-900">🏫 학교 목록</h2>
        <p className="mt-1 text-sm text-slate-500">
          학교를 추가하면 그 학교만의 전용 로그인 링크와 첫 관리자 계정이 함께 만들어져요. 각
          학교의 체육부장에게 로그인 링크를 전달하면, 그 학교의 반/종목/점수를 완전히 독립적으로
          운영할 수 있어요.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-400">
              <th className="px-4 py-2">학교 이름</th>
              <th className="px-4 py-2">로그인 주소</th>
              <th className="px-4 py-2">생성일</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-slate-400">
                  아직 등록된 학교가 없어요. 아래에서 첫 학교를 추가해보세요.
                </td>
              </tr>
            )}
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-800">{s.name}</td>
                <td className="px-4 py-2.5 text-slate-500">/login/{s.slug}</td>
                <td className="px-4 py-2.5 text-slate-400">
                  {new Date(s.created_at).toLocaleDateString("ko-KR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-slate-700">새 학교 추가</p>
        <div className="grid max-w-lg gap-3">
          <div>
            <label className="block text-xs text-slate-500">학교 이름</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="예: 신도중학교 체육한마당"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">
              학교 주소(slug) — 영문 소문자/숫자/하이픈만
            </label>
            <input
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({ ...f, slug: e.target.value.trim().toLowerCase() }))
              }
              placeholder="예: sindo"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              로그인 링크가 /login/{form.slug || "sindo"} 형태로 만들어져요.
            </p>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-semibold text-slate-600">첫 관리자(체육부장) 계정</p>
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-slate-500">이름</label>
                <input
                  value={form.adminName}
                  onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">이메일</label>
                <input
                  type="email"
                  value={form.adminEmail}
                  onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500">비밀번호 (6자 이상)</label>
                <input
                  type="text"
                  value={form.adminPassword}
                  onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
        <button
          onClick={createSchool}
          disabled={busy}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "만드는 중..." : "학교 추가"}
        </button>

        {createdLoginUrl && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-emerald-800">
              학교가 만들어졌어요! 이 로그인 링크를 체육부장 선생님께 전달하세요.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                readOnly
                value={`${origin}${createdLoginUrl}`}
                onFocus={(e) => e.target.select()}
                className="min-w-0 flex-1 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={copyLoginUrl}
                className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                {copied ? "복사됨!" : "링크 복사"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
