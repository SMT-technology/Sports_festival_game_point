import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { AppSettings, CheerAward, ClassRow, EventRow, ScoreRow } from "@/lib/database.types";
import { AdminResultsClient } from "./AdminResultsClient";

export default async function AdminResultsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [
    { data: classesData },
    { data: eventsData },
    { data: scoresData },
    { data: settingsData },
    { data: cheerAwardsData },
  ] = await Promise.all([
    supabase.from("classes").select("*"),
    supabase.from("events").select("*").eq("is_active", true),
    supabase.from("scores").select("*"),
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase.from("cheer_awards").select("*"),
  ]);

  const settings = settingsData as AppSettings | null;

  return (
    <AdminResultsClient
      initialClasses={sortClasses((classesData ?? []) as ClassRow[])}
      initialEvents={sortEvents((eventsData ?? []) as EventRow[])}
      initialScores={(scoresData ?? []) as ScoreRow[]}
      initialRankingsVisible={settings?.rankings_visible ?? true}
      initialCheerResultsVisible={settings?.cheer_results_visible ?? false}
      cheerAwards={(cheerAwardsData ?? []) as CheerAward[]}
    />
  );
}
