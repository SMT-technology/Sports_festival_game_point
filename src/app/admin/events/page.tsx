import { createClient } from "@/lib/supabase/server";
import { sortEvents, sortLocations } from "@/lib/scoring";
import type { EventLocation, EventRow } from "@/lib/database.types";
import { EventsClient } from "./EventsClient";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const [{ data: eventsData }, { data: locationsData }] = await Promise.all([
    supabase.from("events").select("*"),
    supabase.from("event_locations").select("*"),
  ]);
  return (
    <EventsClient
      initialEvents={sortEvents((eventsData ?? []) as EventRow[])}
      initialLocations={sortLocations((locationsData ?? []) as EventLocation[])}
    />
  );
}
