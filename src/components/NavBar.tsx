"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DateWeatherCompact } from "@/components/DateWeatherWidget";

const LINKS = [
  { href: "/input", label: "📝 입력" },
  { href: "/cheer", label: "🎉 응원점수" },
  { href: "/results", label: "🏆 결과" },
];

const DEFAULT_TIMETABLE_URL = "/sports-festival-game_TT.png";

export function NavBar({
  name,
  role,
  orgName,
  logoUrl,
  timetableUrl,
  weatherLat,
  weatherLon,
  weatherLocationName,
}: {
  name: string;
  role: "teacher" | "admin";
  orgName: string;
  logoUrl: string;
  timetableUrl?: string;
  weatherLat?: number;
  weatherLon?: number;
  weatherLocationName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [timetableOpen, setTimetableOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [timetableError, setTimetableError] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
    <header className="border-b border-slate-200 bg-white">
      <div className="h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-orange-500" />
      {weatherLat != null && weatherLon != null && (
        <div className="border-b border-slate-100 bg-slate-50">
          <div className="mx-auto flex max-w-5xl justify-end px-4 py-1">
            <DateWeatherCompact
              lat={weatherLat}
              lon={weatherLon}
              locationName={weatherLocationName ?? ""}
            />
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-y-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={logoError ? "/logo.jpg" : logoUrl}
              alt={`${orgName} 로고`}
              width={24}
              height={24}
              className="h-6 w-6 shrink-0 rounded-full object-cover"
              onError={() => setLogoError(true)}
            />
            <span className="whitespace-nowrap">{orgName}</span>
          </span>
          <nav className="flex flex-wrap items-center gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <button
              onClick={() => setTimetableOpen(true)}
              className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              🗓️ 시간표
            </button>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role === "admin" && (
            <Link
              href="/admin/classes"
              className={`flex items-center gap-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith("/admin")
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              🛠️ 관리자 페이지
            </Link>
          )}
          <span className="whitespace-nowrap text-sm text-slate-500">{name}</span>
          <Link
            href="/change-password"
            className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            🔑 비밀번호 변경
          </Link>
          <button
            onClick={handleSignOut}
            className="whitespace-nowrap rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>

    {timetableOpen && (
      <div
        onClick={() => setTimetableOpen(false)}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        {/* 닫기 버튼은 이미지 크기와 무관하게 화면(오버레이) 기준 모서리에
            고정한다 — 예전엔 이미지 바로 위에 붙여놨더니, 태블릿처럼 세로
            공간이 좁아 이미지가 화면 높이를 거의 다 채우는 경우 버튼이
            화면 위로 밀려 나가 안 보이는 문제가 있었다. */}
        <button
          onClick={() => setTimetableOpen(false)}
          className="absolute right-4 top-4 z-[60] rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg hover:bg-slate-100"
        >
          ✕ 닫기
        </button>
        <div className="relative max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={timetableError ? DEFAULT_TIMETABLE_URL : timetableUrl || DEFAULT_TIMETABLE_URL}
            alt="학년별 경기 일정표"
            onError={() => setTimetableError(true)}
            className="max-h-[85vh] w-auto rounded-xl bg-white object-contain shadow-2xl"
          />
        </div>
      </div>
    )}
    </>
  );
}
