import { createAdminClient } from "@/lib/supabase/admin";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type {
  AppSecrets,
  AppSettings,
  CheerAward,
  ClassRow,
  EventRow,
  ScoreRow,
} from "@/lib/database.types";

export interface PublicResultsData {
  classes: ClassRow[];
  events: EventRow[];
  scores: ScoreRow[];
  cheerAwards: CheerAward[];
  rankingsVisible: boolean;
  cheerResultsVisible: boolean;
  orgName: string;
  logoUrl: string;
}

// 공개 결과 링크(로그인 없이 보는 화면)용 데이터 조회. 서버(관리자 권한 키)
// 에서만 호출하고, 토큰이 app_secrets.public_results_token과 일치할 때만
// 데이터를 내려준다 — 브라우저가 DB에 직접 접근하지 않으므로 RLS를 열
// 필요가 없다. 순위/응원상이 아직 비공개 상태(rankings_visible/
// cheer_results_visible = false)면 해당 데이터는 아예 비워서 내려보내,
// 네트워크 탭을 열어봐도 발표 전 점수가 새어나가지 않게 한다.
export async function getPublicResultsData(token: string): Promise<PublicResultsData | null> {
  if (!token) return null;

  const admin = createAdminClient();
  // 토큰은 학교마다 따로 발급되므로, 먼저 토큰으로 어느 학교의 행인지부터
  // 찾는다 — school_id를 모르는 상태라 eq("school_id", ...)로 미리 좁힐 수
  // 없다. 토큰이 일치하는 행을 찾으면 그 행의 school_id로 이후 모든 조회를
  // 스코프한다.
  const { data: secretsData } = await admin
    .from("app_secrets")
    .select("*")
    .eq("public_results_token", token)
    .maybeSingle();
  const secrets = secretsData as AppSecrets | null;

  if (!secrets?.public_results_token || secrets.public_results_token !== token) {
    return null;
  }

  const schoolId = secrets.school_id;

  const { data: settingsData } = await admin
    .from("app_settings")
    .select("*")
    .eq("school_id", schoolId)
    .single();
  const settings = settingsData as AppSettings | null;

  const rankingsVisible = settings?.rankings_visible ?? true;
  const cheerResultsVisible = settings?.cheer_results_visible ?? false;

  const [classesRes, eventsRes, scoresRes, cheerRes] = await Promise.all([
    admin.from("classes").select("*").eq("school_id", schoolId),
    admin.from("events").select("*").eq("school_id", schoolId).eq("is_active", true),
    rankingsVisible
      ? admin.from("scores").select("*").eq("school_id", schoolId).eq("status", "final")
      : Promise.resolve({ data: [] as ScoreRow[] }),
    cheerResultsVisible
      ? admin.from("cheer_awards").select("*").eq("school_id", schoolId)
      : Promise.resolve({ data: [] as CheerAward[] }),
  ]);

  return {
    classes: sortClasses((classesRes.data ?? []) as ClassRow[]),
    events: sortEvents((eventsRes.data ?? []) as EventRow[]),
    scores: (scoresRes.data ?? []) as ScoreRow[],
    cheerAwards: (cheerRes.data ?? []) as CheerAward[],
    rankingsVisible,
    cheerResultsVisible,
    orgName: settings?.org_name ?? "신도체육한마당",
    logoUrl: settings?.logo_url ?? "/logo.jpg",
  };
}
