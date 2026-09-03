import { requireAdmin } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar name={profile.name} role={profile.role} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <AdminTabs />
        {children}
      </div>
    </div>
  );
}
