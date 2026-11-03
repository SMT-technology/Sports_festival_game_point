import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Supabase 무료 프로젝트는 일정 기간(약 1주일) API 요청이 전혀 없으면 자동으로
// 잠자기(pause) 상태가 된다. vercel.json의 Cron Job이 며칠에 한 번씩 이
// 라우트를 호출해서 아주 가벼운 조회 쿼리 하나를 날려주면, 그 기간을 넘기지
// 않게 되어 프로젝트가 멈추지 않는다. 실제로 하는 일은 그게 전부 — 아무것도
// 바꾸지 않는다.
//
// Vercel Cron이 보내는 요청인지 확인하기 위해 CRON_SECRET 환경변수를 쓴다.
// Vercel 프로젝트 설정(Environment Variables)에 CRON_SECRET을 등록해두면,
// Vercel이 Cron 호출 시 자동으로 Authorization: Bearer <그 값> 헤더를 붙여
// 보내준다 — 그 값이 여기서 확인하는 값과 일치할 때만 실행한다.
export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET 환경변수가 설정되지 않았습니다." },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("schools").select("id").limit(1);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checkedAt: new Date().toISOString() });
}
