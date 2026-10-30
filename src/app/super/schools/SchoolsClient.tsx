"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Profile, School } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DriveLinkHelper } from "@/components/DriveLinkHelper";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_LOGO_URL = "/logo.jpg";

function formatRelativeTime(iso: string, now: number): string {
  const diffSec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}일 전`;
}

export function SchoolsClient({
  initialSchools,
  initialAdmins,
  initialLogos,
  initialLastActivity,
}: {
  initialSchools: School[];
  initialAdmins: Profile[];
  initialLogos: Record<string, string>;
  initialLastActivity: Record<string, string>;
}) {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [admins, setAdmins] = useState<Profile[]>(initialAdmins);
  const [impersonateBusyId, setImpersonateBusyId] = useState<string | null>(null);
  const [impersonateError, setImpersonateError] = useState<string | null>(null);
  const [logos, setLogos] = useState<Record<string, string>>(initialLogos);
  const [logoErrorIds, setLogoErrorIds] = useState<Set<string>>(new Set());
  const [lastActivity, setLastActivity] = useState<Record<string, string>>(initialLastActivity);
  const [now, setNow] = useState(() => Date.now());
  const [form, setForm] = useState({
    name: "",
    slug: "",
    logoUrl: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLoginUrl, setCreatedLoginUrl] = useState<string | null>(null);
  const [createdWarning, setCreatedWarning] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);

  const [logoEditTarget, setLogoEditTarget] = useState<School | null>(null);
  const [logoEditUrl, setLogoEditUrl] = useState("");
  const [logoEditError, setLogoEditError] = useState<string | null>(null);
  const [logoEditBusy, setLogoEditBusy] = useState(false);
  const [logoEditDone, setLogoEditDone] = useState(false);

  function openLogoEdit(s: School) {
    setLogoEditTarget(s);
    setLogoEditUrl(logos[s.id] ?? "");
    setLogoEditError(null);
    setLogoEditDone(false);
  }

  async function confirmLogoEdit() {
    if (!logoEditTarget) return;
    const trimmed = logoEditUrl.trim();
    if (!trimmed) {
      setLogoEditError("로고 이미지 URL을 입력하세요.");
      return;
    }
    setLogoEditBusy(true);
    setLogoEditError(null);
    try {
      const res = await fetch(`/api/super/schools/${logoEditTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: trimmed }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setLogoEditError(body?.error ?? "로고 변경에 실패했습니다.");
        return;
      }
      setLogos((prev) => ({ ...prev, [logoEditTarget.id]: trimmed }));
      setLogoErrorIds((prev) => {
        const next = new Set(prev);
        next.delete(logoEditTarget.id);
        return next;
      });
      setLogoEditDone(true);
    } catch {
      setLogoEditError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLogoEditBusy(false);
    }
  }

  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDone, setEditDone] = useState(false);

  function openEdit(p: Profile) {
    setEditTarget(p);
    setEditName(p.name);
    setEditEmail(p.email);
    setEditPassword("");
    setEditError(null);
    setEditDone(false);
  }

  async function confirmEdit() {
    if (!editTarget) return;
    const trimmedName = editName.trim();
    const trimmedEmail = editEmail.trim();
    const nameChanged = trimmedName !== editTarget.name;
    const emailChanged = trimmedEmail !== editTarget.email;
    if (!nameChanged && !emailChanged && !editPassword) {
      setEditError("이름, 이메일, 비밀번호 중 하나는 바꿔야 해요.");
      return;
    }
    if (nameChanged && !trimmedName) {
      setEditError("이름을 입력하세요.");
      return;
    }
    if (editPassword && editPassword.length < 6) {
      setEditError("비밀번호는 6자 이상으로 입력하세요.");
      return;
    }
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/super/admins/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(nameChanged ? { name: trimmedName } : {}),
          ...(emailChanged ? { email: trimmedEmail } : {}),
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(body?.error ?? "계정 수정에 실패했습니다.");
        return;
      }
      if (nameChanged || emailChanged) {
        setAdmins((prev) =>
          prev.map((a) =>
            a.id === editTarget.id
              ? {
                  ...a,
                  ...(nameChanged ? { name: trimmedName } : {}),
                  ...(emailChanged ? { email: trimmedEmail } : {}),
                }
              : a,
          ),
        );
      }
      setEditDone(true);
    } catch {
      setEditError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setEditBusy(false);
    }
  }

  useEffect(() => {
    const readOrigin = () => setOrigin(window.location.origin);
    readOrigin();
  }, []);

  // "최근 활동" 표시를 1분마다 다시 계산해서 "n분 전" 문구가 계속 최신으로
  // 보이게 한다 (데이터 자체는 realtime 구독으로 바뀌지만, 시간 표시는
  // 데이터가 안 바뀌어도 흘러가야 하므로 별도 타이머가 필요하다).
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  // 전체 학교의 점수/응원점수 변경을 실시간으로 구독해서, 어느 학교가 지금
  // 활발히 쓰이고 있는지 "최근 활동" 칼럼이 새로고침 없이 갱신되게 한다.
  // 총괄자는 RLS상 모든 학교의 행을 볼 수 있으므로 school_id 필터 없이
  // 구독한다.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("super-schools-activity")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scores" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { school_id?: string; updated_at?: string };
          if (!row.school_id) return;
          setLastActivity((prev) => ({
            ...prev,
            [row.school_id!]: row.updated_at ?? new Date().toISOString(),
          }));
          setNow(Date.now());
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cheer_awards" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { school_id?: string; awarded_at?: string };
          if (!row.school_id) return;
          setLastActivity((prev) => ({
            ...prev,
            [row.school_id!]: row.awarded_at ?? new Date().toISOString(),
          }));
          setNow(Date.now());
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      const newSchool = body.school as School;
      setSchools((prev) => [...prev, newSchool]);
      setAdmins((prev) => [...prev, body.admin as Profile]);
      setLogos((prev) => ({ ...prev, [newSchool.id]: body.logoUrl as string }));
      setCreatedLoginUrl(body.loginUrl as string);
      setCreatedWarning((body.warning as string) ?? null);
      setForm({
        name: "",
        slug: "",
        logoUrl: "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
    } catch {
      setError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 총괄자가 특정 학교의 관리자 계정으로 실제 로그인되게 한다 — 매직링크
  // 토큰을 서버에서 받아와 verifyOtp로 그 관리자의 세션을 브라우저에 심는다.
  // 이렇게 하면 이후 /admin 화면은 "진짜 그 관리자가 로그인한 것"과 똑같이
  // 동작해서, 기존 화면 코드를 하나도 바꾸지 않아도 학교별 데이터가 정확히
  // 분리된 채로 보인다.
  async function impersonate(adminId: string) {
    setImpersonateError(null);
    setImpersonateBusyId(adminId);
    try {
      const res = await fetch(`/api/super/admins/${adminId}/impersonate`, { method: "POST" });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setImpersonateError(body?.error ?? "관리자 로그인에 실패했습니다.");
        return;
      }
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: body.tokenHash as string,
        type: "email",
      });
      if (error) {
        setImpersonateError(`로그인 세션 생성에 실패했습니다: ${error.message}`);
        return;
      }
      // NavBar가 이 값을 보고 실제 관리자 이름/이메일 대신 "총괄자 서민택"으로
      // 표시한다 (관리자 개인정보가 화면에 노출되지 않게).
      document.cookie = "impersonating=1; path=/";
      router.replace("/admin/classes");
      router.refresh();
    } catch {
      setImpersonateError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setImpersonateBusyId(null);
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
      <h2 className="text-base font-bold text-slate-900">🏫 학교 목록</h2>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-400">
              <th className="w-56 px-4 py-2">학교 이름</th>
              <th className="w-40 px-4 py-2">로그인 주소</th>
              <th className="px-4 py-2">관리자 계정</th>
              <th className="w-24 whitespace-nowrap px-4 py-2">최근 활동</th>
              <th className="w-28 whitespace-nowrap px-4 py-2">생성일</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  아직 등록된 학교가 없어요. 아래에서 첫 학교를 추가해보세요.
                </td>
              </tr>
            )}
            {schools.map((s) => {
              const schoolAdmins = admins.filter((a) => a.school_id === s.id);
              const logoSrc = logoErrorIds.has(s.id)
                ? DEFAULT_LOGO_URL
                : logos[s.id] || DEFAULT_LOGO_URL;
              return (
                <tr key={s.id} className="border-b border-slate-50 align-top">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openLogoEdit(s)}
                        title="로고 변경"
                        className="group relative h-8 w-8 shrink-0 rounded-full"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoSrc}
                          alt={`${s.name} 로고`}
                          className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                          onError={() =>
                            setLogoErrorIds((prev) => new Set(prev).add(s.id))
                          }
                        />
                        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 text-[10px] text-transparent transition group-hover:bg-black/40 group-hover:text-white">
                          🖊
                        </span>
                      </button>
                      <p className="font-medium text-slate-800">{s.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="mb-1.5 text-xs text-slate-400">/login/{s.slug}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Link
                        href={`/super/schools/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        📊 현황 보기
                      </Link>
                      <Link
                        href={`/login/${s.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        🔗 사이트 열기
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    {schoolAdmins.length === 0 ? (
                      <span className="text-slate-400">관리자 없음</span>
                    ) : (
                      <div className="space-y-1.5">
                        {schoolAdmins.map((a) => (
                          <div key={a.id} className="flex flex-wrap items-center gap-2">
                            <span className="text-slate-700">
                              {a.name} <span className="text-slate-400">({a.email})</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => openEdit(a)}
                              className="shrink-0 rounded-lg border border-slate-200 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-50"
                            >
                              ⚙️ 이름/이메일/비밀번호 수정
                            </button>
                            <button
                              type="button"
                              onClick={() => impersonate(a.id)}
                              disabled={impersonateBusyId === a.id}
                              className="shrink-0 rounded-lg border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                            >
                              {impersonateBusyId === a.id ? "로그인 중..." : "🛠️ 관리자로 로그인"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {lastActivity[s.id] ? (
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                        {formatRelativeTime(lastActivity[s.id], now)}
                      </span>
                    ) : (
                      <span className="text-slate-300">활동 없음</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {impersonateError && <p className="text-xs text-red-600">{impersonateError}</p>}

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
              placeholder="예: shindo"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <p className="mt-1 text-xs text-slate-400">
              로그인 링크가 /login/{form.slug || "shindo"} 형태로 만들어져요.
            </p>
          </div>
          <div>
            <label className="block text-xs text-slate-500">로고 이미지 URL (선택)</label>
            <input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              placeholder="https://... (비워두면 기본 로고가 쓰여요)"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
            <DriveLinkHelper onConvert={(url) => setForm((f) => ({ ...f, logoUrl: url }))} />
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
              <Link
                href={createdLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                열기 ↗
              </Link>
            </div>
            {createdWarning && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                ⚠️ {createdWarning}
              </p>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!editTarget}
        title={`'${editTarget?.name}' 관리자 계정 수정`}
        description={
          editDone ? (
            <p className="text-emerald-700">저장되었습니다.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">이름</label>
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">이메일</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  새 비밀번호 (바꾸지 않으려면 비워두세요, 6자 이상)
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                  placeholder="새 비밀번호"
                />
              </div>
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>
          )
        }
        confirmLabel={editDone ? "닫기" : "저장"}
        onCancel={() => setEditTarget(null)}
        onConfirm={editDone ? () => setEditTarget(null) : confirmEdit}
        loading={editBusy}
      />

      <ConfirmDialog
        open={!!logoEditTarget}
        title={`'${logoEditTarget?.name}' 로고 변경`}
        description={
          logoEditDone ? (
            <p className="text-emerald-700">로고가 변경되었습니다.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500">
                  로고 이미지 URL
                </label>
                <input
                  autoFocus
                  value={logoEditUrl}
                  onChange={(e) => setLogoEditUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-800"
                />
                <DriveLinkHelper onConvert={(url) => setLogoEditUrl(url)} />
              </div>
              {logoEditUrl.trim() && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">미리보기</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoEditUrl.trim()}
                    alt="로고 미리보기"
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                </div>
              )}
              {logoEditError && <p className="text-xs text-red-600">{logoEditError}</p>}
            </div>
          )
        }
        confirmLabel={logoEditDone ? "닫기" : "저장"}
        onCancel={() => setLogoEditTarget(null)}
        onConfirm={logoEditDone ? () => setLogoEditTarget(null) : confirmLogoEdit}
        loading={logoEditBusy}
      />
    </div>
  );
}
