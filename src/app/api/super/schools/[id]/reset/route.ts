import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

// "올해 데이터 보관 후 초기화" — 현재 classes/events/scores/cheer_awards를
// JSON 스냅샷으로 school_archives에 저장한 뒤, 그 네 테이블(과 관련
// score_audit_log)을 비운다. school/profiles/app_settings/app_secrets/
// event_locations는 그대로 남아서, 같은 로그인 링크·계정으로 다음 체육대회를
// 새로 시작할 수 있다. 스냅샷과 삭제가 한 트랜잭션 안에서 원자적으로
// 실행되도록, 실제 작업은 DB 함수 archive_and_reset_school()에 위임한다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { label } = (await request.json().catch(() => ({}))) as { label?: string };

  const admin = createAdminClient();

  const { data: school } = await admin.from("schools").select("id, name").eq("id", id).single();
  if (!school) {
    return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  const [classesCount, eventsCount, scoresCount, cheerAwardsCount] = await Promise.all([
    admin.from("classes").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("events").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("scores").select("id", { count: "exact", head: true }).eq("school_id", id),
    admin.from("cheer_awards").select("id", { count: "exact", head: true }).eq("school_id", id),
  ]);
  const hasData = [classesCount, eventsCount, scoresCount, cheerAwardsCount].some(
    (r) => (r.count ?? 0) > 0,
  );
  if (!hasData) {
    return NextResponse.json(
      { error: "보관할 데이터가 없어요 (반/종목/점수/응원점수가 모두 비어있습니다)." },
      { status: 400 },
    );
  }

  const { data: archiveId, error } = await admin.rpc("archive_and_reset_school", {
    p_school_id: id,
    p_label: label?.trim() || null,
  });
  if (error) {
    return NextResponse.json({ error: `보관 후 초기화 실패: ${error.message}` }, { status: 400 });
  }

  return NextResponse.json({ ok: true, archiveId });
}
