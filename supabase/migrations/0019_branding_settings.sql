-- ============================================================================
-- 다른 학교에서도 재사용할 수 있도록, 대회 이름과 로고 이미지를
-- 관리자가 화면에서 직접 바꿀 수 있게 한다.
--
-- 로그인 화면은 로그인 전(비로그인 상태)에도 대회 이름/로고를 보여줘야
-- 하므로, app_settings의 SELECT 정책을 로그인 여부와 무관하게 누구나
-- 읽을 수 있도록 완화한다(민감한 정보가 없는 테이블이라 안전함).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'org_name'
  ) then
    alter table public.app_settings add column org_name text not null default '신도체육한마당';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'logo_url'
  ) then
    alter table public.app_settings add column logo_url text not null default '/logo.jpg';
  end if;
end $$;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_public" on public.app_settings
for select using (true);
