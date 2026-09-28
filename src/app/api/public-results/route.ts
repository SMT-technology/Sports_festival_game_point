import { NextResponse } from "next/server";
import { getPublicResultsData } from "@/lib/publicResults";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token") ?? "";

  const data = await getPublicResultsData(token);
  if (!data) {
    return NextResponse.json({ error: "링크가 올바르지 않습니다." }, { status: 403 });
  }

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
