import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getPublicBranding } from "@/lib/settings";
import type { School } from "@/lib/database.types";
import { LoginForm } from "../LoginForm";

async function getSchool(slug: string): Promise<School | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("*").eq("slug", slug).maybeSingle();
  return data as School | null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const school = await getSchool(slug);
  const title = school?.name ?? "체육대회 점수 시스템";
  return { title };
}

export default async function SchoolLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const school = await getSchool(slug);

  if (!school) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
        <p className="text-4xl">🔍</p>
        <h1 className="text-lg font-bold text-slate-800">학교를 찾을 수 없어요</h1>
        <p className="text-sm text-slate-500">
          전달받은 링크 주소가 올바른지 다시 확인해주세요.
        </p>
      </div>
    );
  }

  const branding = await getPublicBranding(school.id);

  return (
    <LoginForm
      schoolId={school.id}
      orgName={branding.orgName}
      subtitle={branding.subtitle}
      logoUrl={branding.logoUrl}
      weatherLat={branding.weatherLat}
      weatherLon={branding.weatherLon}
      weatherLocationName={branding.weatherLocationName}
    />
  );
}
