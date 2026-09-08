"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/input", label: "입력" },
  { href: "/cheer", label: "🎉 응원점수" },
  { href: "/results", label: "결과" },
];

export function NavBar({
  name,
  role,
}: {
  name: string;
  role: "teacher" | "admin";
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [timetableOpen, setTimetableOpen] = useState(false);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
    <header className="border-b border-slate-200 bg-white">
      <div className="h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-orange-500" />
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Image
              src="/logo.jpg"
              alt="신도중학교 로고"
              width={24}
              height={24}
              className="rounded-full"
            />
            신도체육한마당
          </span>
          <nav className="flex gap-1">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {role === "admin" && (
            <Link
              href="/admin"
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                pathname.startsWith("/admin")
                  ? "bg-orange-500 text-white"
                  : "bg-orange-50 text-orange-700 hover:bg-orange-100"
              }`}
            >
              🛠️ 관리자 페이지
            </Link>
          )}
          <span className="text-sm text-slate-500">{name}</span>
          <Link
            href="/change-password"
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            🔑 비밀번호 변경
          </Link>
          <button
            onClick={handleSignOut}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>

    <button
      onClick={() => setTimetableOpen(true)}
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-105 hover:shadow-xl"
    >
      🗓️ 시간표
    </button>

    {timetableOpen && (
      <div
        onClick={() => setTimetableOpen(false)}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      >
        <div className="relative max-h-[90vh] max-w-4xl">
          <button
            onClick={() => setTimetableOpen(false)}
            className="absolute -top-10 right-0 text-2xl text-white hover:text-slate-300"
          >
            ✕ 닫기
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/sports-festival-game_TT.png"
            alt="학년별 경기 일정표"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-auto rounded-xl bg-white object-contain shadow-2xl"
          />
        </div>
      </div>
    )}
    </>
  );
}
