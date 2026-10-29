import { requireProfile } from "@/lib/auth";
import { getBranding, getSchoolLoginUrl } from "@/lib/settings";
import { NavBar } from "@/components/NavBar";
import { ContactBadge } from "@/components/ContactBadge";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const schoolId = profile.school_id as string;
  const [branding, loginUrl] = await Promise.all([
    getBranding(schoolId),
    getSchoolLoginUrl(schoolId),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <NavBar name={profile.name} role={profile.role} loginUrl={loginUrl} {...branding} />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <ContactBadge />
    </div>
  );
}
