import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/database.types";

const DEFAULT_ORG_NAME = "신도체육한마당";
const DEFAULT_LOGO_URL = "/logo.jpg";
const DEFAULT_TIMETABLE_URL = "/sports-festival-game_TT.png";
const DEFAULT_WEATHER_LAT = 37.5665;
const DEFAULT_WEATHER_LON = 126.978;
const DEFAULT_WEATHER_LOCATION_NAME = "서울";

// 대회 이름/로고/시간표 이미지/날씨 위치는 관리자가 바꿀 수 있는 설정값이라,
// 로그인 화면을 포함한 여러 서버 컴포넌트에서 공통으로 가져다 쓴다.
// app_settings 조회가 실패해도(아직 마이그레이션을 안 돌렸거나 네트워크 문제
// 등) 기본값으로 대체해서 화면이 깨지지 않게 한다.
export async function getBranding(schoolId: string): Promise<{
  orgName: string;
  logoUrl: string;
  timetableUrl: string;
  weatherLat: number;
  weatherLon: number;
  weatherLocationName: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("org_name, logo_url, timetable_url, weather_lat, weather_lon, weather_location_name")
    .eq("school_id", schoolId)
    .single();
  const settings = data as Pick<
    AppSettings,
    "org_name" | "logo_url" | "timetable_url" | "weather_lat" | "weather_lon" | "weather_location_name"
  > | null;
  return {
    orgName: settings?.org_name || DEFAULT_ORG_NAME,
    logoUrl: settings?.logo_url || DEFAULT_LOGO_URL,
    timetableUrl: settings?.timetable_url || DEFAULT_TIMETABLE_URL,
    weatherLat: settings?.weather_lat ?? DEFAULT_WEATHER_LAT,
    weatherLon: settings?.weather_lon ?? DEFAULT_WEATHER_LON,
    weatherLocationName: settings?.weather_location_name || DEFAULT_WEATHER_LOCATION_NAME,
  };
}

// 로그아웃 후에는 루트 /login(총괄자 전용)이 아니라, 로그인했던 본인 학교의
// 로그인 화면(/login/<slug>)으로 돌아가야 한다. 조회가 실패해도 화면이
// 깨지지 않도록 루트 /login으로 대체한다.
export async function getSchoolLoginUrl(schoolId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase.from("schools").select("slug").eq("id", schoolId).single();
  const slug = (data as { slug: string } | null)?.slug;
  return slug ? `/login/${slug}` : "/login";
}
