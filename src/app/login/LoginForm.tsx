"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidPin, nameToTeacherEmail, pinToTeacherPassword } from "@/lib/teacherAuth";
import { DateWeatherCard } from "@/components/DateWeatherWidget";

function describeAuthError(message: string, role: "teacher" | "admin") {
  if (message.includes("Invalid login credentials")) {
    return role === "teacher"
      ? "성함 또는 비밀번호가 올바르지 않습니다."
      : "이메일 또는 비밀번호가 올바르지 않습니다.";
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

interface LoginFormProps {
  orgName: string;
  logoUrl: string;
  weatherLat: number;
  weatherLon: number;
  weatherLocationName: string;
}

export function LoginForm(props: LoginFormProps) {
  return (
    <Suspense fallback={null}>
      <LoginFormInner {...props} />
    </Suspense>
  );
}

function LoginFormInner({
  orgName,
  logoUrl,
  weatherLat,
  weatherLon,
  weatherLocationName,
}: LoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [role, setRole] = useState<"teacher" | "admin">("teacher");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    let loginEmail: string;
    let loginPassword: string;
    if (role === "teacher") {
      if (!isValidPin(pin)) {
        setError("비밀번호는 숫자 4자리로 입력하세요.");
        return;
      }
      loginEmail = nameToTeacherEmail(name);
      loginPassword = pinToTeacherPassword(pin);
    } else {
      loginEmail = email;
      loginPassword = password;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setLoading(false);
      setError(describeAuthError(error.message, role));
      return;
    }

    // 로그인 성공 후에는 여기서 로딩을 끄지 않는다 — 다음 화면으로 넘어가기
    // 전까지 버튼/스피너가 계속 "로그인 중"으로 보여야, 화면 전환 사이에
    // 아무 반응이 없는 것처럼 보이는 순간이 생기지 않는다.

    const fallback = role === "admin" ? "/admin/classes" : "/input";
    const next = searchParams.get("next") || fallback;
    router.replace(next);
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
      <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <DateWeatherCard
          lat={weatherLat}
          lon={weatherLon}
          locationName={weatherLocationName}
          className="mb-6 w-full max-w-sm"
        />

        <div className="w-full max-w-sm rounded-2xl border border-white/40 bg-white p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-4 ring-blue-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoError ? "/logo.jpg" : logoUrl}
                alt={`${orgName} 로고`}
                width={64}
                height={64}
                className="h-full w-full object-cover"
                onError={() => setLogoError(true)}
              />
            </div>
            <h1 className="mt-3 text-xl font-bold text-slate-900">{orgName}</h1>
            <p className="mt-1 text-sm text-slate-400">점수 관리 시스템</p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setRole("teacher")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                role === "teacher" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"
              }`}
            >
              🙋 교사로 로그인
            </button>
            <button
              type="button"
              onClick={() => setRole("admin")}
              className={`rounded-lg py-2 text-sm font-semibold transition ${
                role === "admin" ? "bg-white text-orange-600 shadow-sm" : "text-slate-500"
              }`}
            >
              🛠️ 관리자로 로그인
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {role === "teacher" ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="name">
                    성함
                  </label>
                  <input
                    id="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700" htmlFor="pin">
                    비밀번호 (4자리)
                  </label>
                  <input
                    id="pin"
                    type="password"
                    required
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    autoComplete="current-password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tracking-[0.5em] focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </>
            ) : (
              <>
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
              </>
            )}

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
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block animate-spin">🔄</span> 로그인 중...
                </span>
              ) : role === "admin" ? (
                "관리자로 로그인"
              ) : (
                "교사로 로그인"
              )}
            </button>
            {loading && (
              <p className="text-center text-xs text-slate-400">
                서버에 접속하고 있어요. 잠시만 기다려주세요...
              </p>
            )}
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            계정이 없으신가요? 관리자에게 계정 생성을 요청하세요.
          </p>
        </div>
      </div>
    </div>
  );
}
