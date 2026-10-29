import { requireAdmin } from "@/lib/auth";
import { getBranding, getSchoolLoginUrl } from "@/lib/settings";
import { NavBar } from "@/components/NavBar";
import { AdminTabs } from "@/components/AdminTabs";
import { ContactBadge } from "@/components/ContactBadge";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();
  const schoolId = profile.school_id as string;
  const [branding, loginUrl] = await Promise.all([
    getBranding(schoolId),
    getSchoolLoginUrl(schoolId),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-orange-50">
      <NavBar
        name={profile.name}
        role={profile.role}
        loginUrl={loginUrl}
        schoolId={schoolId}
        {...branding}
      />
      <div className="mx-auto max-w-6xl px-4 py-6">
        <AdminTabs />
        {children}
      </div>
      <ContactBadge />
    </div>
  );
}
