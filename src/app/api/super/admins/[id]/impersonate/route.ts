import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/database.types";

// 총괄자가 특정 학교의 관리자로 "로그인"할 수 있게 해주는 라우트. 학교별로
// school_id 필터가 없는 기존 화면 코드(입력/결과/관리자 화면 등)를 전혀
// 건드리지 않고도 안전하게 동작하도록, "총괄자인 채로 다른 학교 데이터를
// 보게" 만드는 대신 — Supabase의 매직링크 발급 기능으로 실제 그 관리자
// 계정의 로그인 세션을 만들어서 브라우저에 심어준다. 그러면 auth.uid()가
// 그 관리자 본인이 되므로, 기존 RLS(현재 로그인한 사람의 school_id만 보임)가
// 그대로, 수정 없이 정확하게 동작한다.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("*").eq("id", id).single();
  const targetProfile = target as Profile | null;
  if (!targetProfile || targetProfile.role !== "admin") {
    return NextResponse.json({ error: "관리자 계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: targetProfile.email,
  });
  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "로그인 링크 생성에 실패했습니다." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    email: targetProfile.email,
    tokenHash: data.properties.hashed_token,
  });
}
