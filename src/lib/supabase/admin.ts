import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service role 클라이언트. RLS를 우회하므로 서버 전용 API route에서만,
 * 그리고 호출 전 반드시 현재 세션이 admin인지 별도 확인 후 사용할 것.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
