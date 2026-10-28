import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/database.types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const { name, email, password } = (await request.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name && !email && !password) {
    return NextResponse.json(
      { error: "변경할 이름, 이메일, 비밀번호 중 하나 이상을 입력하세요." },
      { status: 400 },
    );
  }
  if (name !== undefined && !name.trim()) {
    return NextResponse.json({ error: "이름을 입력하세요." }, { status: 400 });
  }
  if (email !== undefined && !EMAIL_RE.test(email.trim())) {
    return NextResponse.json({ error: "유효한 이메일 주소를 입력하세요." }, { status: 400 });
  }
  if (password !== undefined && password.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상으로 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: existing } = await admin.from("profiles").select("*").eq("id", id).single();
  const existingProfile = existing as Profile | null;
  if (!existingProfile) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }
  if (existingProfile.role !== "admin") {
    return NextResponse.json({ error: "학교 관리자 계정만 수정할 수 있습니다." }, { status: 400 });
  }

  const trimmedName = name?.trim();
  const trimmedEmail = email?.trim();

  if (trimmedEmail || password) {
    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      ...(trimmedEmail ? { email: trimmedEmail } : {}),
      ...(password ? { password } : {}),
    });
    if (authError) {
      if (authError.message.toLowerCase().includes("already registered")) {
        return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  if (trimmedName || trimmedEmail) {
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        ...(trimmedName ? { name: trimmedName } : {}),
        ...(trimmedEmail ? { email: trimmedEmail } : {}),
      })
      .eq("id", id);
    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    name: trimmedName ?? existingProfile.name,
    email: trimmedEmail ?? existingProfile.email,
  });
}
