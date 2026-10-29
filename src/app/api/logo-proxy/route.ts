import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 구글 드라이브 등 외부에 호스팅된 로고 이미지는 CORS 헤더(Access-Control-Allow-Origin)를
// 안 보내주는 경우가 많아서, 브라우저가 <canvas>로 그 픽셀을 읽으려 하면
// "tainted canvas" 오류가 나서 조용히 실패한다 (useAccentColor.ts가 이걸 못 읽으면
// 학교 이름 기반의 대체 색상으로 넘어가버려서, 실제 로고 색과 안 맞는 결과가 나온다).
// 이 라우트가 서버에서 대신 이미지를 받아와 같은 출처(same-origin)로 돌려주면,
// 브라우저 쪽에서는 CORS 제한 없이 캔버스로 픽셀을 읽을 수 있다.
//
// 임의의 외부 URL을 그대로 받아 그대로 가져오는 열린 프록시(open proxy)가 되지
// 않도록, 쿼리로 URL을 직접 받지 않고 schoolId로 그 학교의 app_settings.logo_url을
// 서버에서 직접 조회해서 사용한다 — 어차피 그 값은 그 학교 관리자/총괄자만 설정할
// 수 있는 값이라, 비로그인 방문자가 임의의 주소를 우리 서버로 fetch 시키게 할
// 수는 없다.
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const schoolId = searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId가 필요합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("app_settings")
    .select("logo_url")
    .eq("school_id", schoolId)
    .single();
  const logoUrl = (data as { logo_url: string } | null)?.logo_url;
  if (!logoUrl || !/^https?:\/\//i.test(logoUrl)) {
    return NextResponse.json({ error: "프록시할 외부 로고 이미지가 없습니다." }, { status: 404 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(logoUrl, { signal: controller.signal });
    if (!upstream.ok) {
      return NextResponse.json({ error: "이미지를 가져오지 못했습니다." }, { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "가져온 결과가 이미지가 아닙니다." }, { status: 415 });
    }
    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "이미지가 너무 큽니다." }, { status: 413 });
    }
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "이미지를 가져오지 못했습니다." }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
