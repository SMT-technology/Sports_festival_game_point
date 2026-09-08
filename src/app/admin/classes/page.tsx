import { createClient } from "@/lib/supabase/server";
import { sortClasses } from "@/lib/scoring";
import type { ClassRow } from "@/lib/database.types";
import { ClassesClient } from "./ClassesClient";

export default async function AdminClassesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("classes").select("*");

  return <ClassesClient initialClasses={sortClasses((data ?? []) as ClassRow[])} />;
}
