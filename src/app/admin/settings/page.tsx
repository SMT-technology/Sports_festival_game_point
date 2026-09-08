import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/database.types";
import { SettingsClient } from "./SettingsClient";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("*").eq("id", 1).single();
  const settings = data as AppSettings | null;

  return (
    <SettingsClient
      initialOrgName={settings?.org_name ?? "신도체육한마당"}
      initialLogoUrl={settings?.logo_url ?? "/logo.jpg"}
      initialTimetableUrl={settings?.timetable_url ?? "/sports-festival-game_TT.png"}
    />
  );
}
