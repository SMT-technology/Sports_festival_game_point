-- ============================================================================
-- 체육대회가 끝난 학교가 다음 해에 같은 시스템을 다시 쓸 수 있도록,
-- "올해 데이터를 보관(JSON 스냅샷)한 뒤 반/종목/점수/응원점수를 비우는"
-- 초기화 기능을 위한 테이블.
--
-- school_id/profiles/app_settings/app_secrets/event_locations(장소 목록)는
-- 그대로 남겨서, 로그인 링크와 관리자·교사 계정, 기본 설정은 유지한 채
-- 반/종목/점수만 새로 시작할 수 있게 한다.
-- ============================================================================
create table public.school_archives (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text,
  archived_at timestamptz not null default now(),
  data jsonb not null
);

alter table public.school_archives enable row level security;

create policy "school_archives_select_admin_same_school" on public.school_archives
for select using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- 보관(생성)/삭제는 총괄자만 — 되돌릴 수 없는 초기화와 묶여 있는 민감한 동작.
create policy "school_archives_write_super_admin_only" on public.school_archives
for all using (public.is_super_admin()) with check (public.is_super_admin());
