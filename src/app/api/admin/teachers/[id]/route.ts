import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEACHER_PIN, pinToTeacherPassword } from "@/lib/teacherAuth";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  if (id === guard.userId) {
    return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function PATCH(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;

  // 항상 초기 비밀번호(4자리)로 되돌린다 — 교사가 다음 로그인 때 본인이 새로 설정해야 함
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: pinToTeacherPassword(DEFAULT_TEACHER_PIN),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("profiles").update({ must_change_password: true }).eq("id", id);

  return NextResponse.json({ ok: true });
}
