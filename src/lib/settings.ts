import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppSettings } from "@/lib/database.types";

const DEFAULT_ORG_NAME = "신도체육한마당";
const DEFAULT_SUBTITLE = "점수 집계 시스템";
const DEFAULT_LOGO_URL = "/logo.jpg";
const DEFAULT_TIMETABLE_URL = "/sports-festival-game_TT.png";
const DEFAULT_WEATHER_LAT = 37.5665;
const DEFAULT_WEATHER_LON = 126.978;
const DEFAULT_WEATHER_LOCATION_NAME = "서울";

type BrandingSettings = Pick<
  AppSettings,
  | "org_name"
  | "subtitle"
  | "logo_url"
  | "timetable_url"
  | "weather_lat"
  | "weather_lon"
  | "weather_location_name"
>;

function toBranding(settings: BrandingSettings | null) {
  return {
    orgName: settings?.org_name || DEFAULT_ORG_NAME,
    subtitle: settings?.subtitle || DEFAULT_SUBTITLE,
    logoUrl: settings?.logo_url || DEFAULT_LOGO_URL,
    timetableUrl: settings?.timetable_url || DEFAULT_TIMETABLE_URL,
    weatherLat: settings?.weather_lat ?? DEFAULT_WEATHER_LAT,
    weatherLon: settings?.weather_lon ?? DEFAULT_WEATHER_LON,
    weatherLocationName: settings?.weather_location_name || DEFAULT_WEATHER_LOCATION_NAME,
  };
}

const BRANDING_COLUMNS =
  "org_name, subtitle, logo_url, timetable_url, weather_lat, weather_lon, weather_location_name";

// 대회 이름/로고/시간표 이미지/날씨 위치는 관리자가 바꿀 수 있는 설정값이라,
// 로그인 화면을 포함한 여러 서버 컴포넌트에서 공통으로 가져다 쓴다.
// app_settings 조회가 실패해도(아직 마이그레이션을 안 돌렸거나 네트워크 문제
// 등) 기본값으로 대체해서 화면이 깨지지 않게 한다.
// 로그인된 사용자(자기 학교) 전용 — app_settings RLS가 "내 학교 것만" 허용하므로
// 세션 클라이언트로 충분하다.
export async function getBranding(schoolId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select(BRANDING_COLUMNS)
    .eq("school_id", schoolId)
    .single();
  return toBranding(data as BrandingSettings | null);
}

// 로그인 전(비로그인) 화면 전용 — app_settings RLS가 "내 학교 것만"으로 좁혀져
// 있어서(다른 학교 설정을 아무나 못 보게) 세션 클라이언트로는 조회가 막힌다.
// 어느 학교인지는 서버가 slug로 이미 알고 있으므로, 서비스 롤로 그 학교의
// 설정만 직접 가져온다.
export async function getPublicBranding(schoolId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select(BRANDING_COLUMNS)
    .eq("school_id", schoolId)
    .single();
  return toBranding(data as BrandingSettings | null);
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
