"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidPin, pinToTeacherPassword } from "@/lib/teacherAuth";
import type { Role } from "@/lib/database.types";

export function ChangePasswordForm({ required, role }: { required: boolean; role: Role }) {
  const router = useRouter();
  const isTeacher = role === "teacher";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (isTeacher) {
      if (!isValidPin(password)) {
        setError("비밀번호는 숫자 4자리로 입력하세요.");
        return;
      }
    } else if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirm) {
      setError("비밀번호가 서로 일치하지 않습니다.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { data, error: updateError } = await supabase.auth.updateUser({
      password: isTeacher ? pinToTeacherPassword(password) : password,
    });
    if (updateError) {
      setLoading(false);
      setError("변경 실패: " + updateError.message);
      return;
    }

    const userId = data.user?.id;
    if (userId) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", userId);
    }

    setLoading(false);
    router.replace("/input");
    router.refresh();
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-orange-500">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, #fff 0, #fff 2px, transparent 2px, transparent 40px)",
        }}
      />
      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-2xl ring-4 ring-blue-50">
            🔑
          </div>
          <h1 className="mt-3 text-xl font-bold text-slate-900">비밀번호 변경</h1>
          <p className="mt-1 text-sm text-slate-500">
            {required
              ? "최초 로그인입니다. 계속 사용할 새 비밀번호를 설정해주세요."
              : "새 비밀번호를 설정합니다."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              새 비밀번호{isTeacher && " (숫자 4자리)"}
            </label>
            <input
              id="password"
              type="password"
              required
              inputMode={isTeacher ? "numeric" : undefined}
              pattern={isTeacher ? "[0-9]*" : undefined}
              maxLength={isTeacher ? 4 : undefined}
              autoComplete="new-password"
              value={password}
              onChange={(e) =>
                setPassword(isTeacher ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value)
              }
              placeholder={isTeacher ? "숫자 4자리" : "6자 이상"}
              className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isTeacher ? "tracking-[0.5em]" : ""}`}
            />
            {isTeacher && (
              <p className="mt-1 text-xs text-slate-400">숫자만 입력할 수 있어요.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="confirm">
              새 비밀번호 확인
            </label>
            <input
              id="confirm"
              type="password"
              required
              inputMode={isTeacher ? "numeric" : undefined}
              pattern={isTeacher ? "[0-9]*" : undefined}
              maxLength={isTeacher ? 4 : undefined}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) =>
                setConfirm(isTeacher ? e.target.value.replace(/\D/g, "").slice(0, 4) : e.target.value)
              }
              className={`mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${isTeacher ? "tracking-[0.5em]" : ""}`}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "변경 중..." : "비밀번호 변경"}
          </button>
        </form>

        <div className="mt-4 flex justify-center gap-4 text-xs text-slate-400">
          {!required && (
            <button onClick={() => router.back()} className="hover:text-slate-600">
              취소하고 돌아가기
            </button>
          )}
          <button onClick={handleSignOut} className="hover:text-slate-600">
            로그아웃
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
