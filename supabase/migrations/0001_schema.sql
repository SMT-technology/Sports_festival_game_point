-- ============================================================================
-- 체육대회 점수 관리 시스템 - 초기 스키마
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: 로그인한 교사/관리자 프로필 (auth.users 1:1)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin')),
  created_at timestamptz not null default now()
);

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

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- classes: 학년/반 (1학년 1~12반, 2학년 1~12반, 3학년 1~14반)
-- ----------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  grade smallint not null check (grade in (1, 2, 3)),
  class_no smallint not null check (class_no > 0),
  created_at timestamptz not null default now(),
  unique (grade, class_no)
);

-- ----------------------------------------------------------------------------
-- events: 종목 (반대항전 / 단합 미니게임 / 응원·질서)
-- ----------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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

-- ----------------------------------------------------------------------------
-- event_assignments: 종목별 담당(주심) 교사 배정
-- ----------------------------------------------------------------------------
create table public.event_assignments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, teacher_id)
);

-- ----------------------------------------------------------------------------
-- scores: 종목 x 반 점수
-- ----------------------------------------------------------------------------
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  rank_value int,
  pass_value boolean,
  direct_value numeric,
  computed_points numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'final')),
  submitted_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  final_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, class_id)
);

-- ----------------------------------------------------------------------------
-- score_audit_log: 점수 변경 이력
-- ----------------------------------------------------------------------------
create table public.score_audit_log (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null,
  event_id uuid not null,
  class_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id),
  changed_at timestamptz not null default now()
);

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

create or replace function public.event_is_locked(p_event_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select is_locked from public.events where id = p_event_id), true);
$$;

-- ============================================================================
-- 점수 자동 계산 트리거
-- ============================================================================

create or replace function public.compute_score_points()
returns trigger
language plpgsql
as $$
declare
  ev record;
  pts numeric;
begin
  select scoring_type, point_table, pass_points, max_points
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
  else
    pts := 0;
  end if;

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

create trigger trg_compute_score_points
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

create trigger trg_log_score_change
after insert or update on public.scores
for each row execute function public.log_score_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.events enable row level security;
alter table public.event_assignments enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit_log enable row level security;

-- profiles ---------------------------------------------------------------
create policy "profiles_select_self_or_admin" on public.profiles
for select using (auth.uid() = id or public.is_admin());

create policy "profiles_update_self_or_admin" on public.profiles
for update using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

-- 본인이 role을 스스로 승격시키지 못하도록 별도 트리거로 차단 (관리자만 role 변경 가능)
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception '권한(role) 변경은 관리자만 가능합니다';
  end if;
  return new;
end;
$$;

create trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row execute function public.prevent_self_role_escalation();

create policy "profiles_insert_admin_only" on public.profiles
for insert with check (public.is_admin());

create policy "profiles_delete_admin_only" on public.profiles
for delete using (public.is_admin());

-- classes ------------------------------------------------------------------
create policy "classes_select_authenticated" on public.classes
for select using (auth.role() = 'authenticated');

create policy "classes_write_admin_only" on public.classes
for all using (public.is_admin()) with check (public.is_admin());

-- events ---------------------------------------------------------------
create policy "events_select_authenticated" on public.events
for select using (auth.role() = 'authenticated');

create policy "events_write_admin_only" on public.events
for all using (public.is_admin()) with check (public.is_admin());

-- event_assignments ------------------------------------------------------
create policy "assignments_select_own_or_admin" on public.event_assignments
for select using (teacher_id = auth.uid() or public.is_admin());

create policy "assignments_write_admin_only" on public.event_assignments
for all using (public.is_admin()) with check (public.is_admin());

-- scores ---------------------------------------------------------------
create policy "scores_select_authenticated" on public.scores
for select using (auth.role() = 'authenticated');

create policy "scores_insert_assigned_or_admin" on public.scores
for insert with check (
  public.is_admin()
  or (public.is_assigned(event_id) and not public.event_is_locked(event_id))
);

create policy "scores_update_assigned_or_admin" on public.scores
for update using (
  public.is_admin()
  or (public.is_assigned(event_id) and not public.event_is_locked(event_id))
) with check (
  public.is_admin()
  or (public.is_assigned(event_id) and not public.event_is_locked(event_id))
);

-- score_audit_log --------------------------------------------------------
create policy "audit_select_admin_only" on public.score_audit_log
for select using (public.is_admin());

-- ============================================================================
-- Realtime
-- ============================================================================
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.events;
