import { createAdminClient } from "@/lib/supabase/admin";

// 서버 코드(교사/관리자 계정 생성 API)가 auth.users 생성 시점에
// user_metadata에 같이 실어 보내는 값. handle_new_user() 트리거가 이 값을
// provisioning_secret 테이블의 값과 대조해서, 일치할 때만 role/school_id
// 메타데이터를 신뢰한다 — 누군가 Supabase Auth API를 직접 호출해서 다른
// 학교 관리자나 총괄자로 가입해버리는 것을 막기 위함.
export async function getProvisioningSecret(): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("provisioning_secret").select("secret").single();
  return (data as { secret: string } | null)?.secret ?? null;
}
