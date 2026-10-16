import { createClient } from "@/lib/supabase/server";
import type { Profile, School } from "@/lib/database.types";
import { SchoolsClient } from "./SchoolsClient";

export default async function SuperSchoolsPage() {
  const supabase = await createClient();
  const [{ data: schools }, { data: admins }] = await Promise.all([
    supabase.from("schools").select("*").order("created_at"),
    supabase.from("profiles").select("*").eq("role", "admin").order("created_at"),
  ]);

  return (
    <SchoolsClient
      initialSchools={(schools ?? []) as School[]}
      initialAdmins={(admins ?? []) as Profile[]}
    />
  );
}
