import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortEvents, sortLocations } from "@/lib/scoring";
import type { AppSettings, EventLocation, EventRow } from "@/lib/database.types";
import { EventsClient } from "./EventsClient";

export default async function AdminEventsPage() {
  const profile = await requireAdmin();
  const supabase = await createClient();
  const [{ data: eventsData }, { data: locationsData }, { data: settings }] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("event_locations").select("*"),
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
    <EventsClient
      initialEvents={sortEvents((eventsData ?? []) as EventRow[])}
      initialLocations={sortLocations((locationsData ?? []) as EventLocation[])}
      activeGrades={activeGrades}
    />
  );
}
