-- ============================================================================
-- 로그인 없이 볼 수 있는 "공개 결과 링크" 기능
--
-- 담임선생님·다른 교직원이 로그인 없이 /public-results/<토큰> 주소로
-- 들어가면 "학년별 종합 순위"만 실시간(주기적 새로고침)으로 볼 수 있게
-- 한다. 토큰은 관리자 설정 화면에서 확인/재발급할 수 있다.
--
-- ⚠️ 이 토큰을 app_settings 테이블에 넣으면 안 된다 — app_settings는
-- 로그인 화면에서 대회 이름/로고를 보여주려고 "누구나 조회 가능"
-- (select using (true)) 하게 열려 있어서, 그 안에 토큰을 넣으면 아무나
-- API로 토큰을 그대로 읽어갈 수 있어 "링크를 아는 사람만" 이라는 보호가
-- 무의미해진다. 그래서 별도 테이블(app_secrets)에 넣고, 이 테이블은
-- 관리자만 조회/수정할 수 있게 막는다. 실제 공개 결과 화면은 브라우저가
-- 이 테이블에 직접 접근하는 게 아니라, 서버(관리자 권한 키)가 토큰을
-- 대조한 뒤 결과 데이터만 내려주는 방식이라 이 테이블 자체는 외부에
-- 노출되지 않는다.
-- ============================================================================

create table if not exists public.app_secrets (
  id int primary key default 1,
  public_results_token text not null default encode(gen_random_bytes(16), 'hex'),
  constraint app_secrets_singleton check (id = 1)
);

insert into public.app_secrets (id)
values (1)
on conflict (id) do nothing;

alter table public.app_secrets enable row level security;

drop policy if exists "app_secrets_select_admin_only" on public.app_secrets;
create policy "app_secrets_select_admin_only" on public.app_secrets
for select using (public.is_admin());

drop policy if exists "app_secrets_update_admin_only" on public.app_secrets;
create policy "app_secrets_update_admin_only" on public.app_secrets
for update using (public.is_admin()) with check (public.is_admin());
