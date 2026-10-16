import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Profile, School } from "@/lib/database.types";
import { SchoolsClient } from "./SchoolsClient";

export default async function SuperSchoolsPage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: admins }, { data: settingsRows }, { data: scoreRows }, { data: cheerRows }] =
    await Promise.all([
      supabase.from("schools").select("*").order("created_at"),
      supabase.from("profiles").select("*").eq("role", "admin").order("created_at"),
      supabase.from("app_settings").select("school_id, logo_url"),
      supabase.from("scores").select("school_id, updated_at").order("updated_at", { ascending: false }),
      supabase
        .from("cheer_awards")
        .select("school_id, awarded_at")
        .order("awarded_at", { ascending: false }),
    ]);

  const initialLogos = Object.fromEntries(
    ((settingsRows ?? []) as Pick<AppSettings, "school_id" | "logo_url">[]).map((row) => [
      row.school_id,
      row.logo_url,
    ]),
  );

  // 각 학교의 "최근 활동 시각" = scores.updated_at / cheer_awards.awarded_at 중 가장
  // 최신 값. 두 목록 다 최신순 정렬이라, 학교별로 처음 만나는 값이 그 학교의 최신값.
  const lastActivity: Record<string, string> = {};
  for (const row of (scoreRows ?? []) as { school_id: string; updated_at: string }[]) {
    if (!lastActivity[row.school_id]) lastActivity[row.school_id] = row.updated_at;
  }
  for (const row of (cheerRows ?? []) as { school_id: string; awarded_at: string }[]) {
    const current = lastActivity[row.school_id];
    if (!current || new Date(row.awarded_at) > new Date(current)) {
      lastActivity[row.school_id] = row.awarded_at;
    }
  }

  return (
    <SchoolsClient
      initialSchools={(schools ?? []) as School[]}
      initialAdmins={(admins ?? []) as Profile[]}
      initialLogos={initialLogos}
      initialLastActivity={lastActivity}
    />
  );
}
