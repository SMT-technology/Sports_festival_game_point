import { createClient } from "@/lib/supabase/server";
import type { AppSettings, Profile, School } from "@/lib/database.types";
import { SchoolsClient } from "./SchoolsClient";

export default async function SuperSchoolsPage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: admins }, { data: settingsRows }] = await Promise.all([
    supabase.from("schools").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("role", "admin").order("created_at"),
    supabase.from("app_settings").select("school_id, logo_url"),
  ]);

  const initialLogos = Object.fromEntries(
    ((settingsRows ?? []) as Pick<AppSettings, "school_id" | "logo_url">[]).map((row) => [
      row.school_id,
      row.logo_url,
    ]),
  );

  return (
    <SchoolsClient
      initialSchools={(schools ?? []) as School[]}
      initialAdmins={(admins ?? []) as Profile[]}
      initialLogos={initialLogos}
    />
  );
}
