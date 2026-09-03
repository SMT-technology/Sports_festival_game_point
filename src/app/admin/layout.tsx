import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

const TABS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/events", label: "종목·배점" },
  { href: "/admin/teachers", label: "교사 계정" },
  { href: "/admin/scores", label: "점수 관리" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar name={profile.name} role={profile.role} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-6 flex gap-1 border-b border-slate-200">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-t-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-blue-700"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </div>
  );
}
