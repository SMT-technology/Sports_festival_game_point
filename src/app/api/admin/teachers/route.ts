import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_TEACHER_PIN, nameToTeacherEmail, pinToTeacherPassword } from "@/lib/teacherAuth";

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { name } = (await request.json()) as { name?: string };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: nameToTeacherEmail(name),
    password: pinToTeacherPassword(DEFAULT_TEACHER_PIN),
    email_confirm: true,
    user_metadata: { name: name.trim() },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return NextResponse.json(
        {
          error:
            "같은 이름의 교사 계정이 이미 있습니다. 이름을 다르게 구분해서 입력해주세요 (예: 김민수(2반)).",
        },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id });
}
