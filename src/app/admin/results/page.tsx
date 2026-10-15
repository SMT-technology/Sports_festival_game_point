import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents, sortLocations } from "@/lib/scoring";
import type {
  AppSettings,
  CheerAward,
  ClassRow,
  EventLocation,
  EventRow,
  ScoreRow,
} from "@/lib/database.types";
import { AdminResultsClient } from "./AdminResultsClient";

export default async function AdminResultsPage() {
  const profile = await requireAdmin();
  const schoolId = profile.school_id as string;
  const supabase = await createClient();

  const [
    { data: classesData },
    { data: eventsData },
    { data: scoresData },
    { data: settingsData },
    { data: cheerAwardsData },
    { data: locationsData },
  ] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("events").select("*").eq("is_active", true),
    supabase.from("scores").select("*"),
    supabase.from("app_settings").select("*").eq("school_id", schoolId).single(),
    supabase.from("cheer_awards").select("*"),
    supabase.from("event_locations").select("*"),
  ]);

  const settings = settingsData as AppSettings | null;

  return (
    <AdminResultsClient
      schoolId={schoolId}
      initialClasses={sortClasses((classesData ?? []) as ClassRow[])}
      initialEvents={sortEvents((eventsData ?? []) as EventRow[])}
      initialScores={(scoresData ?? []) as ScoreRow[]}
      initialRankingsVisible={settings?.rankings_visible ?? true}
      initialCheerResultsVisible={settings?.cheer_results_visible ?? false}
      cheerAwards={(cheerAwardsData ?? []) as CheerAward[]}
      locations={sortLocations((locationsData ?? []) as EventLocation[])}
    />
  );
}
