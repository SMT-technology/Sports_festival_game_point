import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";

const SLUG_RE = /^[a-z0-9-]+$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEFAULT_LOCATIONS = [
  { name: "운동장", emoji: "🏃", order_index: 0 },
  { name: "체육관", emoji: "🏀", order_index: 1 },
  { name: "본관", emoji: "🏫", order_index: 2 },
  { name: "신관", emoji: "🏢", order_index: 3 },
];

function defaultClasses(schoolId: string) {
  const rows: { school_id: string; grade: 1 | 2 | 3; class_no: number }[] = [];
  for (let c = 1; c <= 12; c++) rows.push({ school_id: schoolId, grade: 1, class_no: c });
  for (let c = 1; c <= 12; c++) rows.push({ school_id: schoolId, grade: 2, class_no: c });
  for (let c = 1; c <= 14; c++) rows.push({ school_id: schoolId, grade: 3, class_no: c });
  return rows;
}

export async function POST(request: Request) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { name, slug, logoUrl, adminName, adminEmail, adminPassword } = (await request
    .json()
    .catch(() => ({}))) as {
    name?: string;
    slug?: string;
    logoUrl?: string;
    adminName?: string;
    adminEmail?: string;
    adminPassword?: string;
  };

  if (!name || !name.trim()) {
    return NextResponse.json({ error: "학교 이름을 입력하세요." }, { status: 400 });
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "학교 주소(slug)는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다." },
      { status: 400 },
    );
  }
  if (!adminName || !adminName.trim()) {
    return NextResponse.json({ error: "관리자 이름을 입력하세요." }, { status: 400 });
  }
  if (!adminEmail || !EMAIL_RE.test(adminEmail.trim())) {
    return NextResponse.json({ error: "유효한 관리자 이메일을 입력하세요." }, { status: 400 });
  }
  if (!adminPassword || adminPassword.length < 6) {
    return NextResponse.json({ error: "비밀번호는 6자 이상으로 입력하세요." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: school, error: schoolError } = await admin
    .from("schools")
    .insert({ name: name.trim(), slug })
    .select("*")
    .single();

  if (schoolError) {
    if (schoolError.message.toLowerCase().includes("duplicate")) {
      return NextResponse.json(
        { error: "이미 사용 중인 학교 주소(slug)입니다. 다른 주소를 입력하세요." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: schoolError.message }, { status: 400 });
  }

  const schoolId = school.id as string;

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email: adminEmail.trim(),
    password: adminPassword,
    email_confirm: true,
    user_metadata: { name: adminName.trim(), school_id: schoolId, role: "admin" },
  });

  if (authError) {
    await admin.from("schools").delete().eq("id", schoolId);
    if (authError.message.toLowerCase().includes("already registered")) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 400 });
    }
    return NextResponse.json({ error: authError.message }, { status: 400 });
  }

  const trimmedLogoUrl = logoUrl?.trim();

  await Promise.all([
    admin.from("app_settings").insert({
      school_id: schoolId,
      org_name: name.trim(),
      ...(trimmedLogoUrl ? { logo_url: trimmedLogoUrl } : {}),
    }),
    admin.from("app_secrets").insert({ school_id: schoolId }),
    admin.from("classes").insert(defaultClasses(schoolId)),
    admin
      .from("event_locations")
      .insert(DEFAULT_LOCATIONS.map((loc) => ({ ...loc, school_id: schoolId }))),
  ]);

  return NextResponse.json({
    school,
    loginUrl: `/login/${slug}`,
    logoUrl: trimmedLogoUrl || "/logo.jpg",
    admin: {
      id: authUser.user!.id,
      email: adminEmail.trim(),
      name: adminName.trim(),
      role: "admin" as const,
      school_id: schoolId,
      must_change_password: false,
      created_at: new Date().toISOString(),
    },
  });
}
