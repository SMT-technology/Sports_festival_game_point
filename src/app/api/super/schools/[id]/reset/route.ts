import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

// "올해 데이터 보관 후 초기화" — 현재 classes/events/scores/cheer_awards를
// JSON 스냅샷으로 school_archives에 저장한 뒤, 그 네 테이블(과 관련
// score_audit_log)을 비운다. school/profiles/app_settings/app_secrets/
// event_locations는 그대로 남아서, 같은 로그인 링크·계정으로 다음 체육대회를
// 새로 시작할 수 있다.
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

  const [{ data: classes }, { data: events }, { data: scores }, { data: cheerAwards }] =
    await Promise.all([
      admin.from("classes").select("*").eq("school_id", id),
      admin.from("events").select("*").eq("school_id", id),
      admin.from("scores").select("*").eq("school_id", id),
      admin.from("cheer_awards").select("*").eq("school_id", id),
    ]);

  if (!classes?.length && !events?.length && !scores?.length && !cheerAwards?.length) {
    return NextResponse.json(
      { error: "보관할 데이터가 없어요 (반/종목/점수/응원점수가 모두 비어있습니다)." },
      { status: 400 },
    );
  }

  const { data: archive, error: archiveError } = await admin
    .from("school_archives")
    .insert({
      school_id: id,
      label: label?.trim() || null,
      data: {
        classes: classes ?? [],
        events: events ?? [],
        scores: scores ?? [],
        cheerAwards: cheerAwards ?? [],
      },
    })
    .select("*")
    .single();
  if (archiveError) {
    return NextResponse.json({ error: `보관 실패: ${archiveError.message}` }, { status: 400 });
  }

  // classes/events를 지우면 on delete cascade로 scores/cheer_awards도 같이
  // 지워진다 (scores.class_id/event_id, cheer_awards.class_id 모두 cascade).
  // score_audit_log는 cascade가 없는 평범한 uuid 컬럼이라 따로 지워야 한다.
  const [classesResult, eventsResult, auditResult] = await Promise.all([
    admin.from("classes").delete().eq("school_id", id),
    admin.from("events").delete().eq("school_id", id),
    admin.from("score_audit_log").delete().eq("school_id", id),
  ]);
  const resetErrors = [classesResult.error, eventsResult.error, auditResult.error].filter(
    (e): e is NonNullable<typeof e> => e !== null,
  );
  if (resetErrors.length > 0) {
    return NextResponse.json(
      {
        error: `데이터는 보관됐지만 초기화 중 일부 실패했어요: ${resetErrors
          .map((e) => e.message)
          .join("; ")}`,
        archiveId: archive.id,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, archiveId: archive.id });
}
