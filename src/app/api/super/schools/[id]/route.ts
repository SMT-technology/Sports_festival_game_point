import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { logoUrl } = (await request.json().catch(() => ({}))) as { logoUrl?: string };

  const trimmedLogoUrl = logoUrl?.trim();
  if (!trimmedLogoUrl) {
    return NextResponse.json({ error: "로고 이미지 URL을 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: school } = await admin.from("schools").select("id").eq("id", id).single();
  if (!school) {
    return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  const { error } = await admin
    .from("app_settings")
    .update({ logo_url: trimmedLogoUrl })
    .eq("school_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, logoUrl: trimmedLogoUrl });
}

// 학교를 완전히 삭제한다 — 되돌릴 수 없음. schools 행을 지우면 거기 걸린
// on delete cascade로 classes/events/scores/cheer_awards/event_locations/
// app_settings/app_secrets/school_archives는 자동으로 같이 지워지지만,
// profiles.school_id는 cascade가 없어서(다른 학교로 잘못 옮겨붙는 사고를
// 막으려고 일부러 cascade를 안 걸어뒀다) 그 학교 교사/관리자 계정을 먼저
// 하나씩 지워야 한다 (auth.users를 지우면 profiles.id -> auth.users(id)
// on delete cascade로 profiles 행도 같이 지워진다).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: school } = await admin.from("schools").select("id, name").eq("id", id).single();
  if (!school) {
    return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: members } = await admin.from("profiles").select("id").eq("school_id", id);
  for (const member of members ?? []) {
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(member.id as string);
    if (deleteUserError) {
      return NextResponse.json(
        {
          error: `계정 삭제 중 실패했습니다 (${deleteUserError.message}). 학교는 아직 지워지지 않았어요 — 다시 시도해주세요.`,
        },
        { status: 400 },
      );
    }
  }

  const { error: deleteSchoolError } = await admin.from("schools").delete().eq("id", id);
  if (deleteSchoolError) {
    return NextResponse.json({ error: deleteSchoolError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
