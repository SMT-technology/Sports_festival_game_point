import { createClient } from "@/lib/supabase/server";
import type { AppSettings } from "@/lib/database.types";

const DEFAULT_ORG_NAME = "신도체육한마당";
const DEFAULT_LOGO_URL = "/logo.jpg";
const DEFAULT_TIMETABLE_URL = "/sports-festival-game_TT.png";

// 대회 이름/로고/시간표 이미지는 관리자가 바꿀 수 있는 설정값이라, 로그인
// 화면을 포함한 여러 서버 컴포넌트에서 공통으로 가져다 쓴다. app_settings
// 조회가 실패해도(아직 마이그레이션을 안 돌렸거나 네트워크 문제 등) 기본값으로
// 대체해서 화면이 깨지지 않게 한다.
export async function getBranding(): Promise<{
  orgName: string;
  logoUrl: string;
  timetableUrl: string;
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("org_name, logo_url, timetable_url")
    .eq("id", 1)
    .single();
  const settings = data as Pick<
    AppSettings,
    "org_name" | "logo_url" | "timetable_url"
  > | null;
  return {
    orgName: settings?.org_name || DEFAULT_ORG_NAME,
    logoUrl: settings?.logo_url || DEFAULT_LOGO_URL,
    timetableUrl: settings?.timetable_url || DEFAULT_TIMETABLE_URL,
  };
}
