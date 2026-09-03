import { createBrowserClient } from "@supabase/ssr";

// 참고: 이 프로젝트의 데이터 타입은 src/lib/database.types.ts 에 수기로 정의되어 있으며,
// 각 컴포넌트에서 쿼리 결과를 해당 타입으로 캐스팅해 사용합니다.
// (supabase-js v2 최신 버전의 Database 제네릭 추론 이슈로 인해 클라이언트 자체에는
//  제네릭을 적용하지 않았습니다.)
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
