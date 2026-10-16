import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/database.types";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };

  if (!password || password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상으로 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("*").eq("id", id).single();
  const existingProfile = existing as Profile | null;
  if (!existingProfile) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (existingProfile.role !== "admin") {
    return NextResponse.json({ error: "학교 관리자 계정만 재설정할 수 있습니다." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
