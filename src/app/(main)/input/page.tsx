import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { ClassRow, EventRow } from "@/lib/database.types";
import { InputClient } from "./InputClient";

export default async function InputPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: classesData }, { data: eventsData }] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("events").select("*").eq("is_active", true),
  ]);

  return (
    <InputClient
      profile={profile}
      events={sortEvents((eventsData ?? []) as EventRow[])}
      classes={sortClasses((classesData ?? []) as ClassRow[])}
    />
  );
}
