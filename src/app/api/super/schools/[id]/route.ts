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
