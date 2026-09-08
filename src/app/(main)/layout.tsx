import { requireProfile } from "@/lib/auth";
import { getBranding } from "@/lib/settings";
import { NavBar } from "@/components/NavBar";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const [profile, branding] = await Promise.all([requireProfile(), getBranding()]);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar name={profile.name} role={profile.role} {...branding} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
