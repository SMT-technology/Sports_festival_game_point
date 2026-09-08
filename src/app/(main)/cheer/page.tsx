import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses } from "@/lib/scoring";
import type { CheerAward, ClassRow } from "@/lib/database.types";
import { CheerClient } from "./CheerClient";

export default async function CheerPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: classesData }, { data: awardsData }] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("cheer_awards").select("*"),
  ]);

  return (
    <CheerClient
      role={profile.role}
      initialClasses={sortClasses((classesData ?? []) as ClassRow[])}
      initialAwards={(awardsData ?? []) as CheerAward[]}
    />
  );
}
