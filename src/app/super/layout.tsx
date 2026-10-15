import { requireSuperAdmin } from "@/lib/auth";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">🧭 총괄자 관리</h1>
          <p className="mt-0.5 text-sm text-slate-400">학교별 체육대회 점수 시스템 운영</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
