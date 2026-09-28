import { createClient } from "@/lib/supabase/server";
import type { AppSecrets, AppSettings } from "@/lib/database.types";
import { SettingsClient } from "./SettingsClient";

export default async function AdminSettingsPage() {
  const supabase = await createClient();
  const [{ data }, { data: secretsData }] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).single(),
    supabase.from("app_secrets").select("*").eq("id", 1).single(),
  ]);
  const settings = data as AppSettings | null;
  const secrets = secretsData as AppSecrets | null;

  return (
    <SettingsClient
      initialOrgName={settings?.org_name ?? "신도체육한마당"}
      initialLogoUrl={settings?.logo_url ?? "/logo.jpg"}
      initialTimetableUrl={settings?.timetable_url ?? "/sports-festival-game_TT.png"}
      initialWeatherLat={settings?.weather_lat ?? 37.5665}
      initialWeatherLon={settings?.weather_lon ?? 126.978}
      initialWeatherLocationName={settings?.weather_location_name ?? "서울"}
      initialPublicResultsToken={secrets?.public_results_token ?? ""}
    />
  );
}
