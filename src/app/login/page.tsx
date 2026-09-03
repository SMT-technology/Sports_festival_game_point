"use client";

import { Suspense, useState, type FormEvent } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function describeAuthError(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("Email not confirmed")) {
    return "이메일 인증이 완료되지 않은 계정입니다. Supabase 대시보드 Authentication > Users에서 해당 계정의 인증 상태를 확인하세요.";
  }
  if (message.includes("Failed to fetch") || message.includes("fetch failed")) {
    return "Supabase 서버에 연결할 수 없습니다. NEXT_PUBLIC_SUPABASE_URL 값이 올바른지 확인하세요.";
  }
  if (message.toLowerCase().includes("api key") || message.toLowerCase().includes("apikey")) {
    return "Supabase API 키가 올바르지 않습니다. NEXT_PUBLIC_SUPABASE_ANON_KEY 값을 확인하세요.";
  }
  return `로그인 실패: ${message}`;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);

    if (error) {
      setError(describeAuthError(error.message));
      return;
    }

    const fallback = role === "admin" ? "/admin" : "/input";
    const next = searchParams.get("next") || fallback;
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-orange-500 px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 select-none text-6xl opacity-20"
      >
        <span className="absolute left-[6%] top-[10%]">🏃</span>
        <span className="absolute left-[80%] top-[8%]">🏆</span>
        <span className="absolute left-[12%] top-[70%]">🎉</span>
        <span className="absolute left-[85%] top-[65%]">⚽</span>
        <span className="absolute left-[45%] top-[85%]">🥇</span>
        <span className="absolute left-[50%] top-[5%]">📣</span>
      </div>

      <div className="relative w-full max-w-sm rounded-3xl bg-white/95 p-8 shadow-2xl backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full shadow-md ring-4 ring-blue-100">
            <Image src="/logo.jpg" alt="신도중학교 로고" width={80} height={80} priority />
          </div>
          <h1 className="mt-3 text-xl font-extrabold text-slate-900">체육대회 점수 관리</h1>
          <p className="mt-1 text-sm text-slate-500">신도중학교 체육대회 🎊</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setRole("teacher")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              role === "teacher" ? "bg-white text-blue-700 shadow" : "text-slate-500"
            }`}
          >
            🙋 교사로 로그인
          </button>
          <button
            type="button"
            onClick={() => setRole("admin")}
            className={`rounded-lg py-2 text-sm font-semibold transition ${
              role === "admin" ? "bg-white text-orange-600 shadow" : "text-slate-500"
            }`}
          >
            🛠️ 관리자로 로그인
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
              role === "admin"
                ? "bg-orange-500 hover:bg-orange-600"
                : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "로그인 중..." : role === "admin" ? "관리자로 로그인" : "교사로 로그인"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          계정이 없으신가요? 관리자(체육부장) 선생님께 계정 생성을 요청하세요.
        </p>
      </div>
    </div>
  );
}
