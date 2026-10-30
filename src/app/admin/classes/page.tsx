import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses } from "@/lib/scoring";
import type { AppSettings, ClassRow } from "@/lib/database.types";
import { ClassesClient } from "./ClassesClient";

export default async function AdminClassesPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ data }, { data: settings }] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase
      .from("app_settings")
      .select("active_grades")
      .eq("school_id", profile.school_id as string)
      .single(),
  ]);
  const activeGrades = (settings as Pick<AppSettings, "active_grades"> | null)?.active_grades ?? [
    1, 2, 3,
  ];

  return (
    <ClassesClient
      initialClasses={sortClasses((data ?? []) as ClassRow[])}
      initialActiveGrades={activeGrades}
      schoolId={profile.school_id as string}
    />
  );
}
