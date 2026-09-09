import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents, sortLocations } from "@/lib/scoring";
import type { CheerAward, ClassRow, EventLocation, EventRow } from "@/lib/database.types";
import { AdminScoresClient } from "./AdminScoresClient";

export default async function AdminScoresPage() {
  const supabase = await createClient();

  const [{ data: classesData }, { data: eventsData }, { data: cheerAwardsData }, { data: locationsData }] =
    await Promise.all([
      supabase.from("classes").select("*"),
      supabase.from("events").select("*"),
      supabase.from("cheer_awards").select("*"),
      supabase.from("event_locations").select("*"),
    ]);

  return (
    <AdminScoresClient
      classes={sortClasses((classesData ?? []) as ClassRow[])}
      events={sortEvents((eventsData ?? []) as EventRow[])}
      initialCheerAwards={(cheerAwardsData ?? []) as CheerAward[]}
      locations={sortLocations((locationsData ?? []) as EventLocation[])}
    />
  );
}
