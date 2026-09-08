-- ============================================================================
-- 응원/질서 점수를 종목별 점수 입력과 완전히 분리된 "누적 지급" 방식으로 바꾼다.
--
-- 기존에는 종목 점수 입력 화면에서 반마다 0~20점을 한 번 입력하는
-- 방식이었는데(덮어쓰기), 이제는 "응원점수" 화면에서 버튼을 눌러 0~100점
-- 사이 점수를 줄 때마다 새로운 지급 기록이 쌓이는(누적) 방식으로 바꾼다.
-- 반의 응원 점수 총합 = 이 표에서 그 반에 지급된 모든 점수의 합.
--
-- 응원상은 종합 순위(반대항전 등)와 완전히 별도로 집계·시상하므로,
-- 이 표는 scores/events와 무관한 독립된 테이블이다.
-- ============================================================================

create table if not exists public.cheer_awards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  points numeric not null check (points >= 0 and points <= 100),
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now()
);

alter table public.cheer_awards enable row level security;

-- 모든 로그인 사용자가 조회 가능(응원점수 화면에서 현재 누적 점수를 봐야 함)
drop policy if exists "cheer_awards_select_authenticated" on public.cheer_awards;
create policy "cheer_awards_select_authenticated" on public.cheer_awards
for select using (auth.role() = 'authenticated');

-- 모든 로그인 사용자(교사 포함)가 응원 점수를 지급할 수 있음 — 별도 배정 없음
drop policy if exists "cheer_awards_insert_authenticated" on public.cheer_awards;
create policy "cheer_awards_insert_authenticated" on public.cheer_awards
for insert with check (auth.role() = 'authenticated');

-- 잘못 지급된 기록은 관리자만 삭제 가능
drop policy if exists "cheer_awards_delete_admin_only" on public.cheer_awards;
create policy "cheer_awards_delete_admin_only" on public.cheer_awards
for delete using (public.is_admin());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cheer_awards'
  ) then
    alter publication supabase_realtime add table public.cheer_awards;
  end if;
end $$;
