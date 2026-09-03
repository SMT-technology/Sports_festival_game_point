import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { ClassRow, EventRow, ScoreRow } from "@/lib/database.types";
import { ResultsClient } from "./ResultsClient";

export default async function ResultsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: classesData }, { data: eventsData }, { data: scoresData }] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("events").select("*").eq("is_active", true),
    supabase.from("scores").select("*"),
  ]);

  return (
    <ResultsClient
      role={profile.role}
      initialClasses={sortClasses((classesData ?? []) as ClassRow[])}
      initialEvents={sortEvents((eventsData ?? []) as EventRow[])}
      initialScores={(scoresData ?? []) as ScoreRow[]}
    />
  );
}
