import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AppSecrets, AppSettings } from "@/lib/database.types";
import { SettingsClient } from "./SettingsClient";

export default async function AdminSettingsPage() {
  const profile = await requireAdmin();
  const schoolId = profile.school_id as string;
  const supabase = await createClient();
  const [{ data }, { data: secretsData }] = await Promise.all([
    supabase.from("app_settings").select("*").eq("school_id", schoolId).single(),
    supabase.from("app_secrets").select("*").eq("school_id", schoolId).single(),
  ]);
  const settings = data as AppSettings | null;
  const secrets = secretsData as AppSecrets | null;

  return (
    <SettingsClient
      schoolId={schoolId}
      initialOrgName={settings?.org_name ?? "신도체육한마당"}
      initialSubtitle={settings?.subtitle ?? "점수 집계 시스템"}
      initialLogoUrl={settings?.logo_url ?? "/logo.jpg"}
      initialTimetableUrl={settings?.timetable_url ?? "/sports-festival-game_TT.png"}
      initialWeatherLat={settings?.weather_lat ?? 37.5665}
      initialWeatherLon={settings?.weather_lon ?? 126.978}
      initialWeatherLocationName={settings?.weather_location_name ?? "서울"}
      initialPublicResultsToken={secrets?.public_results_token ?? ""}
    />
  );
}
