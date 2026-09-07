import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidPin, nameToTeacherEmail, pinToTeacherPassword } from "@/lib/teacherAuth";
import type { Profile } from "@/lib/database.types";

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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { name, pin } = (await request.json().catch(() => ({}))) as {
    name?: string;
    pin?: string;
  };

  const admin = createAdminClient();

  if (pin !== undefined) {
    if (!isValidPin(pin)) {
      return NextResponse.json({ error: "비밀번호는 숫자 4자리로 입력하세요." }, { status: 400 });
    }
    const { error } = await admin.auth.admin.updateUserById(id, {
      password: pinToTeacherPassword(pin),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    // 관리자가 임시 비밀번호를 다시 지정했으므로, 다음 로그인 때 본인이 새로 설정하도록 강제
    await admin.from("profiles").update({ must_change_password: true }).eq("id", id);
  }

  if (name !== undefined) {
    const trimmed = name.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
    }

    const { data: existing } = await admin.from("profiles").select("*").eq("id", id).single();
    const existingProfile = existing as Profile | null;

    // 교사 계정은 이름으로 로그인용 내부 이메일을 만들기 때문에, 이름이
    // 바뀌면 로그인용 이메일도 함께 바꿔줘야 새 이름으로 로그인할 수 있다.
    // 관리자 계정은 실제 이메일로 로그인하므로 이름만 바꾸고 이메일은 그대로 둔다.
    if (existingProfile?.role === "teacher") {
      const newEmail = nameToTeacherEmail(trimmed);
      const { error } = await admin.auth.admin.updateUserById(id, { email: newEmail });
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
      await admin.from("profiles").update({ name: trimmed, email: newEmail }).eq("id", id);
    } else {
      await admin.from("profiles").update({ name: trimmed }).eq("id", id);
    }
  }

  return NextResponse.json({ ok: true });
}
