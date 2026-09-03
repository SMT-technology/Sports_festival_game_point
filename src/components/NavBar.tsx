"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/input", label: "입력" },
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
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
            체육대회 점수 관리
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
          <button
            onClick={handleSignOut}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      </div>
    </header>
  );
}
