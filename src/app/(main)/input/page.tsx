import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { ClassRow, EventRow } from "@/lib/database.types";
import { InputClient } from "./InputClient";

export default async function InputPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: classesData } = await supabase.from("classes").select("*");
  const classes = sortClasses((classesData ?? []) as ClassRow[]);

  let events: EventRow[] = [];

  if (profile.role === "admin") {
    const { data } = await supabase.from("events").select("*").eq("is_active", true);
    events = sortEvents((data ?? []) as EventRow[]);
  } else {
    const { data } = await supabase
      .from("event_assignments")
      .select("event:events(*)")
      .eq("teacher_id", profile.id);

    const raw = (data ?? [])
      .map((row) => row.event as unknown as EventRow | null)
      .filter((e): e is EventRow => !!e && e.is_active);
    events = sortEvents(raw);
  }

  return <InputClient profile={profile} events={events} classes={classes} />;
}
