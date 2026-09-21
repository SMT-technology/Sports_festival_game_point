import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/database.types";

const DEFAULT_ORG_NAME = "신도체육한마당";
const DEFAULT_LOGO_URL = "/logo.jpg";
const DEFAULT_WEATHER_LAT = 37.5665;
const DEFAULT_WEATHER_LON = 126.978;
const DEFAULT_WEATHER_LOCATION_NAME = "서울";

// 대회 이름/로고/날씨 위치는 관리자가 바꿀 수 있는 설정값이라,
// 로그인 화면을 포함한 여러 서버 컴포넌트에서 공통으로 가져다 쓴다.
// app_settings 조회가 실패해도(아직 마이그레이션을 안 돌렸거나 네트워크 문제
// 등) 기본값으로 대체해서 화면이 깨지지 않게 한다.
export async function getBranding(): Promise<{
  orgName: string;
  logoUrl: string;
  weatherLat: number;
  weatherLon: number;
  weatherLocationName: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("org_name, logo_url, weather_lat, weather_lon, weather_location_name")
    .eq("id", 1)
    .single();
  const settings = data as Pick<
    AppSettings,
    "org_name" | "logo_url" | "weather_lat" | "weather_lon" | "weather_location_name"
  > | null;
  return {
    orgName: settings?.org_name || DEFAULT_ORG_NAME,
    logoUrl: settings?.logo_url || DEFAULT_LOGO_URL,
    weatherLat: settings?.weather_lat ?? DEFAULT_WEATHER_LAT,
    weatherLon: settings?.weather_lon ?? DEFAULT_WEATHER_LON,
    weatherLocationName: settings?.weather_location_name || DEFAULT_WEATHER_LOCATION_NAME,
  };
}
