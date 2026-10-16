"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Profile, School } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const DEFAULT_LOGO_URL = "/logo.jpg";

export function SchoolsClient({
  initialSchools,
  initialAdmins,
  initialLogos,
}: {
  initialSchools: School[];
  initialAdmins: Profile[];
  initialLogos: Record<string, string>;
}) {
  const [schools, setSchools] = useState<School[]>(initialSchools);
  const [admins, setAdmins] = useState<Profile[]>(initialAdmins);
  const [logos, setLogos] = useState<Record<string, string>>(initialLogos);
  const [logoErrorIds, setLogoErrorIds] = useState<Set<string>>(new Set());
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
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editDone, setEditDone] = useState(false);

  function openEdit(p: Profile) {
    setEditTarget(p);
    setEditEmail(p.email);
    setEditPassword("");
    setEditError(null);
    setEditDone(false);
  }

  async function confirmEdit() {
    if (!editTarget) return;
    const trimmedEmail = editEmail.trim();
    const emailChanged = trimmedEmail !== editTarget.email;
    if (!emailChanged && !editPassword) {
      setEditError("이메일 또는 비밀번호 중 하나는 바꿔야 해요.");
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
          ...(emailChanged ? { email: trimmedEmail } : {}),
          ...(editPassword ? { password: editPassword } : {}),
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setEditError(body?.error ?? "계정 수정에 실패했습니다.");
        return;
      }
      if (emailChanged) {
        setAdmins((prev) =>
          prev.map((a) => (a.id === editTarget.id ? { ...a, email: trimmedEmail } : a)),
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
              <th className="px-4 py-2">관리자 계정</th>
              <th className="px-4 py-2">생성일</th>
            </tr>
          </thead>
          <tbody>
            {schools.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-slate-400">
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
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={logoSrc}
                        alt={`${s.name} 로고`}
                        className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
                        onError={() =>
                          setLogoErrorIds((prev) => new Set(prev).add(s.id))
                        }
                      />
                      <div>
                        <p className="font-medium text-slate-800">{s.name}</p>
                        <button
                          type="button"
                          onClick={() => openLogoEdit(s)}
                          className="text-xs text-slate-400 underline hover:text-slate-600"
                        >
                          🖼 로고 변경
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/login/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline hover:text-blue-800"
                    >
                      /login/{s.slug}
                    </Link>
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
                              ⚙️ 이메일/비밀번호 수정
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-400">
                    {new Date(s.created_at).toLocaleDateString("ko-KR")}
                  </td>
                </tr>
              );
            })}
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
            <p className="mt-1 text-xs text-slate-400">
              나중에 학교 목록에서 언제든 바꿀 수 있어요. 해당 학교 관리자도 직접 설정 화면에서
              바꿀 수 있어요.
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
              <Link
                href={createdLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                열기 ↗
              </Link>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!editTarget}
        title={`'${editTarget?.name}' 관리자 계정 수정`}
        description={
          editDone ? (
            <p className="text-emerald-700">
              저장되었습니다. 바뀐 이메일/비밀번호를 해당 관리자에게 전달해주세요.
            </p>
          ) : (
            <div className="space-y-3">
              <p>
                오타가 났거나 비밀번호를 잊어버렸을 때 여기서 바로 고칠 수 있어요. 바꿀 항목만
                입력하세요.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-500">이메일</label>
                <input
                  type="email"
                  autoFocus
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
              <p>
                어딘가에 이미지를 먼저 업로드하고, 그 이미지 주소(URL)를 붙여넣으세요. 이
                로고는 해당 학교의 로그인 화면과 상단 메뉴에 바로 반영돼요.
              </p>
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
