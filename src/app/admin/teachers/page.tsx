import { createClient } from "@/lib/supabase/server";
import { sortEvents } from "@/lib/scoring";
import type { EventAssignment, EventRow, Profile } from "@/lib/database.types";
import { TeachersClient } from "./TeachersClient";

export default async function AdminTeachersPage() {
  const supabase = await createClient();

  const [{ data: profiles }, { data: events }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("events").select("*").eq("is_active", true),
    supabase.from("event_assignments").select("*"),
  ]);

  return (
    <TeachersClient
      initialProfiles={(profiles ?? []) as Profile[]}
      events={sortEvents((events ?? []) as EventRow[])}
      initialAssignments={(assignments ?? []) as EventAssignment[]}
    />
  );
}
