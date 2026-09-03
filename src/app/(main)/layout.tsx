import { requireProfile } from "@/lib/auth";
import { NavBar } from "@/components/NavBar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar name={profile.name} role={profile.role} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
