-- ============================================================================
-- 신도체육한마당 점수 관리 시스템 - 통합 스키마 (전체 설치용, 단일 파일)
--
-- 이 파일 하나만 실행하면 0001_schema.sql ~ 0022_event_locations.sql을
-- 순서대로 전부 실행한 것과 동일한 최종 상태가 만들어집니다.
--
-- ⚠️ 용도 안내
-- - "완전히 새로운 Supabase 프로젝트"에 처음 설치할 때, 또는 DB를 완전히
--   새로 만드는(초기화하는) 경우에 이 파일 하나만 실행하면 됩니다.
--   (SQL Editor에서 "+ New query" 한 번만 누르고 이 파일 내용을 붙여넣어
--   실행하면 끝 — 0001~0022를 하나씩 실행할 필요가 없습니다)
-- - 이미 0001~0022 중 일부를 실행해서 사용 중인(진행 중인) 프로젝트라면,
--   기존처럼 아직 실행 안 한 번호(0001부터 순서대로, 없는 파일만)를 계속
--   이어서 실행하는 걸 권장합니다. 이 파일은 각 객체를 "있으면 건너뛰고,
--   없으면 최신 형태로 만드는" 방식으로 작성되어 있어 기존 프로젝트에
--   다시 실행해도 안전(idempotent)하지만, 0004/0009/0011처럼 과거의
--   "잘못 들어간 데이터를 정리"하는 단계는 포함하지 않습니다 — 그런 정리는
--   이미 0001~0022을 순서대로 실행하며 끝난 것으로 간주합니다.
-- - 0001~0022 개별 파일은 지우지 않고 그대로 둡니다. 이 파일은 그 파일들을
--   대체하는 게 아니라, "새 프로젝트를 한 번에 세팅하기 위한 요약본"입니다.
--   앞으로 새 기능을 추가할 때는 여전히 0023, 0024...처럼 번호를 이어서
--   새 마이그레이션 파일을 만들고, 이 파일도 함께 갱신해주세요.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: 로그인한 교사/관리자 프로필 (auth.users 1:1)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'must_change_password'
  ) then
    alter table public.profiles add column must_change_password boolean not null default true;
    update public.profiles set must_change_password = false;
  end if;
end $$;

-- 신규 가입 시 profiles 행 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    'teacher'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- classes: 학년/반
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade in (1, 2, 3)),
  class_no smallint not null check (class_no > 0),
  created_at timestamptz not null default now(),
  unique (grade, class_no)
);

-- ----------------------------------------------------------------------------
-- event_locations: 종목 분류(장소) 목록 — 관리자가 자유롭게 추가/수정/삭제
-- ----------------------------------------------------------------------------
create table if not exists public.event_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '📍',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_locations drop constraint if exists event_locations_name_not_blank;
alter table public.event_locations add constraint event_locations_name_not_blank
  check (length(trim(name)) > 0);

insert into public.event_locations (name, emoji, order_index) values
  ('운동장', '🏃', 0),
  ('체육관', '🏀', 1),
  ('본관', '🏫', 2),
  ('신관', '🏢', 3)
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- events: 종목 (category = event_locations.name과 같은 자유 텍스트 장소명)
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null check (category in ('relay', 'minigame', 'cheer')),
  scoring_type text not null check (scoring_type in ('rank', 'pass_fail', 'direct')),
  point_table jsonb not null default '{"1":100,"2":80,"3":60,"4":40,"5":20}'::jsonb,
  pass_points numeric not null default 20,
  max_points numeric not null default 10,
  order_index int not null default 0,
  is_active boolean not null default true,
  is_locked boolean not null default false,
  created_at timestamptz not null default now()
);

-- category는 더 이상 field/gym/minigame 3개로 고정되지 않는다 — 관리자가
-- event_locations 목록에서 자유롭게 추가한 장소 이름이 그대로 들어간다
-- (비어있지만 않으면 됨. 예전 이름이 뭐든 동적으로 찾아 제약을 교체)
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;

  alter table public.events add constraint events_category_not_blank
    check (length(trim(category)) > 0);
end $$;

-- scoring_type 허용값을 최종 형태(rank/pass_fail/direct/tier)로 정리
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%scoring_type%'
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;

  alter table public.events add constraint events_scoring_type_check
    check (scoring_type in ('rank', 'pass_fail', 'direct', 'tier'));
end $$;

-- 종목별 대상 학년 (기본값: 1,2,3학년 전체)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'grades'
  ) then
    alter table public.events add column grades smallint[] not null default '{1,2,3}';
  end if;
end $$;

alter table public.events drop constraint if exists events_grades_check;
alter table public.events add constraint events_grades_check
  check (
    array_length(grades, 1) > 0
    and grades <@ array[1, 2, 3]::smallint[]
  );

-- 단계별(tier) 채점: 단계 이름 + 점수 목록
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'tier_options'
  ) then
    alter table public.events add column tier_options jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- 이름 중복 방지 (신규 설치 시 위 create table에서 이미 unique 처리됨 — 기존 환경 보정용)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_name_key'
  ) then
    alter table public.events add constraint events_name_key unique (name);
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- event_assignments: (레거시, 앱에서 더 이상 사용하지 않음 — 하위 호환을 위해 유지)
-- ----------------------------------------------------------------------------
create table if not exists public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, teacher_id)
);

-- ----------------------------------------------------------------------------
-- scores: 종목 x 반 점수
-- ----------------------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  rank_value int,
  pass_value boolean,
  direct_value numeric,
  computed_points numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'final')),
  submitted_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  final_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, class_id)
);

alter table public.scores drop constraint if exists scores_submitted_by_fkey;
alter table public.scores add constraint scores_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;

alter table public.scores drop constraint if exists scores_updated_by_fkey;
alter table public.scores add constraint scores_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

-- 응원 추가 점수(레거시, 0017부터는 cheer_awards로 대체 — 과거 데이터 보존용으로만 유지)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scores' and column_name = 'bonus_points'
  ) then
    alter table public.scores
      add column bonus_points numeric not null default 0
        check (bonus_points >= 0 and bonus_points <= 20);
  end if;
end $$;

-- 단계별(tier) 채점 시 선택된 단계의 배열 인덱스
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scores' and column_name = 'tier_index'
  ) then
    alter table public.scores add column tier_index int;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- score_audit_log: 점수 변경 이력
-- ----------------------------------------------------------------------------
create table if not exists public.score_audit_log (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null,
  event_id uuid not null,
  class_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

alter table public.score_audit_log drop constraint if exists score_audit_log_changed_by_fkey;
alter table public.score_audit_log add constraint score_audit_log_changed_by_fkey
  foreign key (changed_by) references public.profiles(id) on delete set null;

-- ----------------------------------------------------------------------------
-- app_settings: 앱 전역 설정 (싱글턴 1행)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id smallint primary key default 1,
  rankings_visible boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint app_settings_singleton check (id = 1)
);

insert into public.app_settings (id, rankings_visible)
values (1, true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'cheer_results_visible'
  ) then
    alter table public.app_settings add column cheer_results_visible boolean not null default false;
  end if;

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

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'timetable_url'
  ) then
    alter table public.app_settings add column timetable_url text not null default '/sports-festival-game_TT.png';
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- cheer_awards: 응원/질서 점수 누적 지급 기록 (종합 순위와 완전히 별도 집계)
-- ----------------------------------------------------------------------------
create table if not exists public.cheer_awards (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  points numeric not null check (points >= -100 and points <= 100),
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now()
);

-- 감점(마이너스 지급)도 허용하도록 points 범위를 -100~100으로 정리 (기존 환경 보정용)
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cheer_awards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%points%'
  loop
    execute format('alter table public.cheer_awards drop constraint %I', r.conname);
  end loop;

  alter table public.cheer_awards add constraint cheer_awards_points_check
    check (points >= -100 and points <= 100);
end $$;

-- ============================================================================
-- 헬퍼 함수
-- ============================================================================

create or replace function public.is_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ※ 현재 앱 코드에서는 사용하지 않음(레거시, event_assignments 제도 폐지에 따름).
create or replace function public.is_assigned(p_event_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.event_assignments
    where event_id = p_event_id and teacher_id = auth.uid()
  );
$$;

-- ※ 관리자 화면의 "입력 잠금" UI는 제거됨. 정책 호환을 위해 함수는 남겨둠(항상 해제 상태로 취급).
create or replace function public.event_is_locked(p_event_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select is_locked from public.events where id = p_event_id), true);
$$;

-- ============================================================================
-- 점수 자동 계산 트리거 (최종 버전 — 순위/통과실패/직접입력/단계별 모두 지원,
-- 응원 추가 점수는 종합 점수에 더 이상 합산하지 않음)
-- ============================================================================

create or replace function public.compute_score_points()
returns trigger
language plpgsql
as $$
declare
  ev record;
  pts numeric;
begin
  select scoring_type, point_table, pass_points, max_points, tier_options
    into ev
    from public.events
    where id = new.event_id;

  if ev.scoring_type = 'rank' then
    if new.rank_value is null then
      pts := 0;
    else
      pts := coalesce((ev.point_table ->> new.rank_value::text)::numeric, 0);
    end if;
  elsif ev.scoring_type = 'pass_fail' then
    pts := case when new.pass_value is true then coalesce(ev.pass_points, 0) else 0 end;
  elsif ev.scoring_type = 'direct' then
    pts := coalesce(new.direct_value, 0);
    if pts < 0 or pts > ev.max_points then
      raise exception '점수(%)가 허용 범위(0~%)를 벗어났습니다', pts, ev.max_points;
    end if;
  elsif ev.scoring_type = 'tier' then
    if new.tier_index is null then
      pts := 0;
    else
      pts := coalesce((ev.tier_options -> new.tier_index ->> 'points')::numeric, 0);
    end if;
  else
    pts := 0;
  end if;

  -- 응원 추가 점수(bonus_points)는 종합 점수에 합산하지 않는다.
  -- 응원상은 별도의 cheer_awards 테이블로 집계된다.
  new.computed_points := pts;
  new.updated_at := now();
  new.updated_by := auth.uid();

  if new.status = 'final' and (tg_op = 'INSERT' or old.status is distinct from 'final') then
    new.final_at := now();
    if new.submitted_by is null then
      new.submitted_by := auth.uid();
    end if;
  elsif new.status = 'draft' then
    new.final_at := null;
  end if;

  return new;
end;
$$;

create or replace trigger trg_compute_score_points
before insert or update on public.scores
for each row execute function public.compute_score_points();

-- ============================================================================
-- 감사 로그 트리거
-- ============================================================================

create or replace function public.log_score_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_action text;
begin
  if tg_op = 'INSERT' then
    v_action := 'create';
  elsif new.status = 'final' and old.status is distinct from 'final' then
    v_action := 'final_submit';
  elsif old.status = 'final' and new.status = 'draft' then
    v_action := 'unlock';
  else
    v_action := 'update';
  end if;

  insert into public.score_audit_log
    (score_id, event_id, class_id, action, old_data, new_data, changed_by)
  values (
    new.id, new.event_id, new.class_id, v_action,
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    to_jsonb(new),
    auth.uid()
  );

  return new;
end;
$$;

create or replace trigger trg_log_score_change
after insert or update on public.scores
for each row execute function public.log_score_change();

-- 점수를 삭제(취소)한 기록도 이력에 남긴다 (교사 본인 취소 포함)
create or replace function public.log_score_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.score_audit_log
    (score_id, event_id, class_id, action, old_data, new_data, changed_by)
  values (
    old.id, old.event_id, old.class_id, 'delete',
    to_jsonb(old), null,
    auth.uid()
  );
  return old;
end;
$$;

create or replace trigger trg_log_score_delete
after delete on public.scores
for each row execute function public.log_score_delete();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.events enable row level security;
alter table public.event_assignments enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit_log enable row level security;
alter table public.app_settings enable row level security;
alter table public.cheer_awards enable row level security;
alter table public.event_locations enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- 본인이 role을 스스로 승격시키지 못하도록 별도 트리거로 차단 (관리자만 role 변경 가능).
-- 단, SQL Editor 등 로그인 세션이 없는 컨텍스트(auth.uid() is null)에서는 예외 허용.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception '권한(role) 변경은 관리자만 가능합니다';
  end if;
  return new;
end;
$$;

create or replace trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row execute function public.prevent_self_role_escalation();

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only" on public.profiles
for insert with check (public.is_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only" on public.profiles
for delete using (public.is_admin());

-- classes ------------------------------------------------------------------
drop policy if exists "classes_select_authenticated" on public.classes;
create policy "classes_select_authenticated" on public.classes
for select using (auth.role() = 'authenticated');

drop policy if exists "classes_write_admin_only" on public.classes;
create policy "classes_write_admin_only" on public.classes
for all using (public.is_admin()) with check (public.is_admin());

-- events ---------------------------------------------------------------
drop policy if exists "events_select_authenticated" on public.events;
create policy "events_select_authenticated" on public.events
for select using (auth.role() = 'authenticated');

drop policy if exists "events_write_admin_only" on public.events;
create policy "events_write_admin_only" on public.events
for all using (public.is_admin()) with check (public.is_admin());

-- event_assignments ------------------------------------------------------
drop policy if exists "assignments_select_own_or_admin" on public.event_assignments;
create policy "assignments_select_own_or_admin" on public.event_assignments
for select using (teacher_id = auth.uid() or public.is_admin());

drop policy if exists "assignments_write_admin_only" on public.event_assignments;
create policy "assignments_write_admin_only" on public.event_assignments
for all using (public.is_admin()) with check (public.is_admin());

-- scores ---------------------------------------------------------------
drop policy if exists "scores_select_authenticated" on public.scores;
create policy "scores_select_authenticated" on public.scores
for select using (auth.role() = 'authenticated');

drop policy if exists "scores_insert_assigned_or_admin" on public.scores;
drop policy if exists "scores_update_assigned_or_admin" on public.scores;
drop policy if exists "scores_insert_authenticated_or_admin" on public.scores;
create policy "scores_insert_authenticated_or_admin" on public.scores
for insert with check (
  public.is_admin()
  or (auth.role() = 'authenticated' and not public.event_is_locked(event_id))
);

drop policy if exists "scores_update_draft_or_admin" on public.scores;
create policy "scores_update_draft_or_admin" on public.scores
for update using (
  public.is_admin()
  or (auth.role() = 'authenticated' and status = 'draft' and not public.event_is_locked(event_id))
) with check (
  public.is_admin()
  or (auth.role() = 'authenticated' and not public.event_is_locked(event_id))
);

-- 교사는 본인이 최종 제출한(submitted_by = 자기 자신) 점수만 취소(삭제)할 수
-- 있고, 관리자는 지금처럼 아무 점수나 초기화할 수 있다.
drop policy if exists "scores_delete_admin_only" on public.scores;
drop policy if exists "scores_delete_admin_or_own" on public.scores;
create policy "scores_delete_admin_or_own" on public.scores
for delete using (
  public.is_admin()
  or (auth.role() = 'authenticated' and submitted_by = auth.uid())
);

-- score_audit_log --------------------------------------------------------
-- 교사도 본인/타인의 점수 변경 이력을 볼 수 있어야 자기 취소 기능을 신뢰할 수 있다.
drop policy if exists "audit_select_admin_only" on public.score_audit_log;
drop policy if exists "audit_select_authenticated" on public.score_audit_log;
create policy "audit_select_authenticated" on public.score_audit_log
for select using (auth.role() = 'authenticated');

-- app_settings -------------------------------------------------------------
-- 로그인 화면에서 비로그인 상태로도 대회 이름/로고를 봐야 하므로 공개 조회 허용.
drop policy if exists "app_settings_select_authenticated" on public.app_settings;
drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_public" on public.app_settings
for select using (true);

drop policy if exists "app_settings_update_admin_only" on public.app_settings;
create policy "app_settings_update_admin_only" on public.app_settings
for update using (public.is_admin()) with check (public.is_admin());

-- cheer_awards ---------------------------------------------------------------
drop policy if exists "cheer_awards_select_authenticated" on public.cheer_awards;
create policy "cheer_awards_select_authenticated" on public.cheer_awards
for select using (auth.role() = 'authenticated');

drop policy if exists "cheer_awards_insert_authenticated" on public.cheer_awards;
create policy "cheer_awards_insert_authenticated" on public.cheer_awards
for insert with check (auth.role() = 'authenticated');

drop policy if exists "cheer_awards_delete_admin_only" on public.cheer_awards;
create policy "cheer_awards_delete_admin_only" on public.cheer_awards
for delete using (public.is_admin());

-- event_locations ------------------------------------------------------------
drop policy if exists "event_locations_select_authenticated" on public.event_locations;
create policy "event_locations_select_authenticated" on public.event_locations
for select using (auth.role() = 'authenticated');

drop policy if exists "event_locations_write_admin_only" on public.event_locations;
create policy "event_locations_write_admin_only" on public.event_locations
for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Realtime
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scores'
  ) then
    alter publication supabase_realtime add table public.scores;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events'
  ) then
    alter publication supabase_realtime add table public.events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'app_settings'
  ) then
    alter publication supabase_realtime add table public.app_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cheer_awards'
  ) then
    alter publication supabase_realtime add table public.cheer_awards;
  end if;
end $$;

-- ============================================================================
-- 시드 데이터: 반 목록 (1학년 1~12반, 2학년 1~12반, 3학년 1~14반)
-- 종목(events)은 시드하지 않습니다 — 관리자 페이지 "종목 이름 관리"에서
-- 직접 추가하세요 (학교마다 종목 구성이 다르기 때문입니다).
-- ============================================================================
insert into public.classes (grade, class_no)
select 1, gs from generate_series(1, 12) gs
union all
select 2, gs from generate_series(1, 12) gs
union all
select 3, gs from generate_series(1, 14) gs
on conflict (grade, class_no) do nothing;
