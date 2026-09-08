-- ============================================================================
-- 앱 전역 설정(app_settings) - 학생용 순위 화면 공개/비공개 제어
--
-- 최종 순위 발표는 운동장에서 직접 하기로 되어 있어서, 입력이 다 끝나갈
-- 무렵에는 미리 스포되지 않도록 관리자가 순위 화면을 수동으로 숨길 수
-- 있어야 한다. 딱 1행짜리 전역 설정 테이블을 두고, 모든 로그인 사용자가
-- 실시간으로 이 값을 구독해서 화면에 반영한다(관리자만 값을 바꿀 수 있음).
-- ============================================================================

create table if not exists public.app_settings (
  id smallint primary key default 1,
  rankings_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, rankings_visible)
values (1, true)
on conflict (id) do nothing;

alter table public.app_settings enable row level security;

drop policy if exists "app_settings_select_authenticated" on public.app_settings;
create policy "app_settings_select_authenticated" on public.app_settings
for select using (auth.role() = 'authenticated');

drop policy if exists "app_settings_update_admin_only" on public.app_settings;
create policy "app_settings_update_admin_only" on public.app_settings
for update using (public.is_admin()) with check (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;
end $$;
