import { createClient } from "@/lib/supabase/server";
import type { School } from "@/lib/database.types";
import { SchoolsClient } from "./SchoolsClient";

export default async function SuperSchoolsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("*").order("created_at");

  return <SchoolsClient initialSchools={(data ?? []) as School[]} />;
}
