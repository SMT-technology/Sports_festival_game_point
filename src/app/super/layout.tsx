import { requireSuperAdmin } from "@/lib/auth";
import { SuperLogoutButton } from "./SuperLogoutButton";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-white to-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-bold text-slate-900">🧭 총괄자 관리</h1>
          <SuperLogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
