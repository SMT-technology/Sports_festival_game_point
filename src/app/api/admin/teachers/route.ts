import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { email, password, name } = (await request.json()) as {
    email?: string;
    password?: string;
    name?: string;
  };

  if (!email || !password || !name) {
    return NextResponse.json({ error: "이메일, 비밀번호, 이름을 모두 입력하세요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id });
}
