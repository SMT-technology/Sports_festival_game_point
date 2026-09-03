import { createClient } from "@/lib/supabase/server";
import { sortEvents } from "@/lib/scoring";
import type { EventRow } from "@/lib/database.types";
import { EventsClient } from "./EventsClient";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*");
  return <EventsClient initialEvents={sortEvents((data ?? []) as EventRow[])} />;
}
