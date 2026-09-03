import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { ClassRow, EventRow } from "@/lib/database.types";
import { AdminScoresClient } from "./AdminScoresClient";

export default async function AdminScoresPage() {
  const supabase = await createClient();

  const [{ data: classesData }, { data: eventsData }] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("events").select("*"),
  ]);

  return (
    <AdminScoresClient
      classes={sortClasses((classesData ?? []) as ClassRow[])}
      events={sortEvents((eventsData ?? []) as EventRow[])}
    />
  );
}
