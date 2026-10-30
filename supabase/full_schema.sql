-- ============================================================================
-- 체육대회 점수 관리 시스템 - 통합 스키마 (전체 설치용, 단일 파일)
--
-- 이 파일 하나만 실행하면 0001_schema.sql ~ 0032_active_grades.sql을
-- 순서대로 전부 실행한 것과 동일한 최종 상태가 만들어집니다.
--
-- ⚠️ 용도 안내
-- - "완전히 새로운 Supabase 프로젝트"에 처음 설치할 때, 또는 DB를 완전히
--   새로 만드는(초기화하는) 경우에 이 파일 하나만 실행하면 됩니다.
--   (SQL Editor에서 "+ New query" 한 번만 누르고 이 파일 내용을 붙여넣어
--   실행하면 끝 — 0001~0030을 하나씩 실행할 필요가 없습니다)
-- - 이미 0001~0025까지 적용된 기존 프로젝트(여러 학교 전환 이전)에는 이 파일을
--   그대로 다시 실행하지 마세요 — 0026_multi_school.sql은 기존 데이터를
--   비우는 파괴적 마이그레이션이라 별도로, 한 번만 실행해야 합니다.
-- - 이 파일은 0001~0030을 대체하는 게 아니라 "새 프로젝트를 한 번에 세팅하기
--   위한 요약본"입니다. 앞으로 새 기능을 추가할 때는 여전히 0033, 0034...처럼
--   번호를 이어서 새 마이그레이션 파일을 만들고, 이 파일도 함께 갱신해주세요.
-- - 이 시스템은 여러 학교가 하나의 DB를 공유하는 멀티 스쿨 구조입니다.
--   총괄자(super_admin)가 학교(schools)를 만들고, 각 학교 관리자(admin)와
--   교사(teacher)는 자기 학교 데이터만 보고 수정할 수 있습니다.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- schools: 학교 목록 (총괄자가 생성, slug가 로그인 주소 /login/<slug>에 쓰임)
-- ----------------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles: 로그인한 교사/관리자/총괄자 프로필 (auth.users 1:1)
-- super_admin은 school_id가 null(특정 학교에 속하지 않음), teacher/admin은 필수.
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'teacher' check (role in ('teacher', 'admin', 'super_admin')),
  school_id uuid references public.schools(id),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  constraint profiles_school_id_matches_role check (
    (role = 'super_admin' and school_id is null)
    or (role in ('teacher', 'admin') and school_id is not null)
  )
);

-- 발급 비밀값: 총괄자가 교사/관리자 계정을 만들 때만 아는 값. 이 값이 없거나
-- 틀리면 회원가입 메타데이터(role/school_id)를 신뢰하지 않는다 — Supabase
-- 프로젝트의 이메일 회원가입이 켜져 있어도 누가 직접 supabase.auth.signUp()을
-- 호출해서 다른 학교 관리자나 총괄자로 가입해버리는 것을 막기 위함.
create table if not exists public.provisioning_secret (
  id boolean primary key default true check (id),
  secret text not null default encode(gen_random_bytes(32), 'hex')
);
insert into public.provisioning_secret (id) values (true) on conflict (id) do nothing;

alter table public.provisioning_secret enable row level security;
-- 일부러 정책을 하나도 안 만든다 — RLS는 켜져 있는데 정책이 없으면 클라이언트
-- (anon/authenticated 키)로는 어떤 요청도 통과하지 못한다. 서비스 롤 키는 RLS를
-- 우회하므로 서버 코드(계정 생성 API)에서만 읽을 수 있다.

-- 신규 가입 시 profiles 행 자동 생성 — user_metadata의 school_id/role도 반영한다
-- (관리자가 교사를 만들거나, 총괄자가 새 학교의 첫 관리자를 만들 때 서버 코드가
-- auth.users 생성 시점에 이 메타데이터를 같이 채워 보낸다). role/school_id를
-- 요청했는데 발급 비밀값이 없거나 틀리면 teacher/school_id=null로 강등하고,
-- 그래도 school_id가 없으면(= 신뢰할 수 없는 자율 가입) 가입 자체를 거부한다.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  requested_role text := coalesce(new.raw_user_meta_data ->> 'role', 'teacher');
  requested_school_id uuid := nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid;
  provided_secret text := new.raw_user_meta_data ->> 'provision_secret';
  real_secret text;
begin
  select secret into real_secret from public.provisioning_secret limit 1;

  if (requested_role in ('admin', 'super_admin') or requested_school_id is not null)
     and (real_secret is null or provided_secret is distinct from real_secret) then
    requested_role := 'teacher';
    requested_school_id := null;
  end if;

  if requested_role = 'teacher' and requested_school_id is null then
    raise exception '신뢰할 수 없는 가입 요청입니다. 관리자에게 계정 생성을 요청하세요.';
  end if;

  insert into public.profiles (id, email, name, role, school_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    requested_role,
    requested_school_id
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- classes: 학년/반 (학교별)
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade smallint not null check (grade in (1, 2, 3)),
  class_no smallint not null check (class_no > 0),
  created_at timestamptz not null default now(),
  unique (school_id, grade, class_no)
);

-- ----------------------------------------------------------------------------
-- event_locations: 종목 분류(장소) 목록 — 학교별 관리자가 자유롭게 추가/수정/삭제
-- ----------------------------------------------------------------------------
create table if not exists public.event_locations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '📍',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

-- ----------------------------------------------------------------------------
-- events: 종목 (category = event_locations.name과 같은 자유 텍스트 장소명)
-- ----------------------------------------------------------------------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  category text not null check (length(trim(category)) > 0),
  scoring_type text not null check (scoring_type in ('rank', 'pass_fail', 'direct', 'tier')),
  point_table jsonb not null default '{"1":100,"2":80,"3":60,"4":40,"5":20}'::jsonb,
  pass_points numeric not null default 20,
  max_points numeric not null default 10,
  order_index int not null default 0,
  is_active boolean not null default true,
  is_locked boolean not null default false,
  grades smallint[] not null default '{1,2,3}',
  tier_options jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (school_id, name),
  constraint events_grades_check check (array_length(grades, 1) > 0 and grades <@ array[1, 2, 3]::smallint[])
);

-- ----------------------------------------------------------------------------
-- scores: 종목 x 반 점수 (school_id는 event/class와 같은 학교여야 하며, 매
-- insert 때 트리거가 로그인한 사람의 학교로 자동으로 채운다)
-- ----------------------------------------------------------------------------
create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  rank_value int,
  pass_value boolean,
  direct_value numeric,
  tier_index int,
  bonus_points numeric not null default 0 check (bonus_points >= 0 and bonus_points <= 20),
  computed_points numeric not null default 0,
  status text not null default 'draft' check (status in ('draft', 'final')),
  submitted_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  final_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (event_id, class_id)
);

-- ----------------------------------------------------------------------------
-- score_audit_log: 점수 변경 이력
-- ----------------------------------------------------------------------------
create table if not exists public.score_audit_log (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  score_id uuid not null,
  event_id uuid not null,
  class_id uuid not null,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- app_settings: 학교별 설정 (PK = school_id, 학교당 1행)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  rankings_visible boolean not null default true,
  cheer_results_visible boolean not null default false,
  org_name text not null default '우리학교',
  subtitle text not null default '점수 집계 시스템',
  logo_url text not null default '/logo.jpg',
  timetable_url text not null default '/sports-festival-game_TT.png',
  weather_lat numeric not null default 37.5665,
  weather_lon numeric not null default 126.9780,
  weather_location_name text not null default '서울',
  -- 학교가 실제로 체육대회를 운영하는 학년만 골라둔다 (반 관리 화면에서
  -- 학년 섹션을 보이거나 숨기는 데에만 쓰임 — classes/events의 grade 값
  -- 범위 자체는 그대로 1~3).
  active_grades smallint[] not null default '{1,2,3}',
  updated_at timestamptz not null default now(),
  constraint app_settings_active_grades_check check (
    array_length(active_grades, 1) > 0
    and active_grades <@ array[1, 2, 3]::smallint[]
  )
);

-- ----------------------------------------------------------------------------
-- app_secrets: 학교별 비공개 설정값 (PK = school_id, 학교당 1행) — 관리자만 조회/수정
-- ----------------------------------------------------------------------------
create table if not exists public.app_secrets (
  school_id uuid primary key references public.schools(id) on delete cascade,
  public_results_token text not null default encode(gen_random_bytes(16), 'hex')
);

-- ----------------------------------------------------------------------------
-- school_archives: 체육대회가 끝난 뒤 "올해 데이터 보관 후 초기화"를 누르면
-- 그 시점의 classes/events/scores/cheer_awards를 JSON으로 통째로 저장해두는
-- 테이블. school_id/profiles/app_settings/app_secrets/event_locations는 그대로
-- 두고 반/종목/점수만 비워서, 다음 해에 같은 로그인 링크·계정으로 새로 시작할
-- 수 있게 한다.
-- ----------------------------------------------------------------------------
create table if not exists public.school_archives (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  label text,
  archived_at timestamptz not null default now(),
  data jsonb not null
);

-- ----------------------------------------------------------------------------
-- cheer_awards: 응원/질서 점수 누적 지급 기록 (종합 순위와 완전히 별도 집계)
-- ----------------------------------------------------------------------------
create table if not exists public.cheer_awards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  points numeric not null check (points >= -100 and points <= 100),
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now()
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

create or replace function public.is_super_admin()
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'super_admin'
  );
$$;

create or replace function public.current_school_id()
returns uuid
language sql stable
security definer set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
$$;

-- 매 insert마다 "로그인한 사람의 학교"를 무조건 채워 넣는다 (클라이언트가 다른
-- school_id를 보내도 무시하고 덮어쓴다).
create or replace function public.set_school_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- 로그인한 사람(교사/관리자)의 요청이면 current_school_id()가 그 사람의
  -- 학교를 돌려주므로, 클라이언트가 보낸 school_id는 무시하고 무조건
  -- 덮어쓴다 (다른 학교로 끼워 넣기 차단). 서비스 롤 키로 서버 코드에서
  -- 직접 insert하는 경우(예: 총괄자가 새 학교를 만들 때의 기본 반/장소
  -- 시드)는 auth.uid()가 없어 current_school_id()가 null이 되므로, 이때는
  -- 서버가 명시적으로 지정한 school_id를 그대로 둔다.
  if public.current_school_id() is not null then
    new.school_id := public.current_school_id();
  end if;
  return new;
end;
$$;

create or replace trigger trg_set_school_id before insert on public.classes
for each row execute function public.set_school_id();
create or replace trigger trg_set_school_id before insert on public.event_locations
for each row execute function public.set_school_id();
create or replace trigger trg_set_school_id before insert on public.events
for each row execute function public.set_school_id();
create or replace trigger trg_set_school_id before insert on public.scores
for each row execute function public.set_school_id();
create or replace trigger trg_set_school_id before insert on public.score_audit_log
for each row execute function public.set_school_id();
create or replace trigger trg_set_school_id before insert on public.cheer_awards
for each row execute function public.set_school_id();

-- scores/cheer_awards의 class_id·event_id가 실제로 같은 학교 소속인지 검증
-- (단순 FK만으로는 다른 학교의 class_id/event_id를 집어넣는 걸 막을 수 없음).
-- 트리거 이름이 set_school_id보다 알파벳상 뒤라서 school_id가 먼저 채워진
-- 뒤에 이 검증이 실행된다.
create or replace function public.verify_same_school_reference()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'scores' then
    if not exists (
      select 1 from public.classes where id = new.class_id and school_id = new.school_id
    ) then
      raise exception '반(class_id)이 이 점수의 학교(school_id)와 일치하지 않습니다';
    end if;
    if not exists (
      select 1 from public.events where id = new.event_id and school_id = new.school_id
    ) then
      raise exception '종목(event_id)이 이 점수의 학교(school_id)와 일치하지 않습니다';
    end if;
  elsif TG_TABLE_NAME = 'cheer_awards' then
    if not exists (
      select 1 from public.classes where id = new.class_id and school_id = new.school_id
    ) then
      raise exception '반(class_id)이 이 응원점수의 학교(school_id)와 일치하지 않습니다';
    end if;
  end if;
  return new;
end;
$$;

create or replace trigger trg_verify_same_school_reference
before insert or update on public.scores
for each row execute function public.verify_same_school_reference();

create or replace trigger trg_verify_same_school_reference
before insert or update on public.cheer_awards
for each row execute function public.verify_same_school_reference();

-- ※ 관리자 화면의 "입력 잠금" UI는 제거됨. 정책 호환을 위해 함수는 남겨둠(항상 해제 상태로 취급).
create or replace function public.event_is_locked(p_event_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select coalesce((select is_locked from public.events where id = p_event_id), true);
$$;

-- ============================================================================
-- 점수 자동 계산 트리거 (순위/통과실패/직접입력/단계별 모두 지원, 응원 추가
-- 점수는 종합 점수에 합산하지 않음)
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
-- 운영 함수: "올해 데이터 보관 후 초기화"를 하나의 트랜잭션으로 묶는다
-- (스냅샷 insert + 삭제가 분리된 여러 요청이면, 중간에 실패할 때 일부만 지워진
-- 애매한 상태가 될 수 있어서 DB 함수 하나로 원자적으로 실행한다)
-- ============================================================================

create or replace function public.archive_and_reset_school(p_school_id uuid, p_label text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_archive_id uuid;
  v_data jsonb;
begin
  select jsonb_build_object(
    'classes', coalesce((select jsonb_agg(c) from public.classes c where c.school_id = p_school_id), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(e) from public.events e where e.school_id = p_school_id), '[]'::jsonb),
    'scores', coalesce((select jsonb_agg(s) from public.scores s where s.school_id = p_school_id), '[]'::jsonb),
    'cheerAwards', coalesce((select jsonb_agg(ca) from public.cheer_awards ca where ca.school_id = p_school_id), '[]'::jsonb)
  ) into v_data;

  insert into public.school_archives (school_id, label, data)
  values (p_school_id, nullif(trim(p_label), ''), v_data)
  returning id into v_archive_id;

  delete from public.classes where school_id = p_school_id;
  delete from public.events where school_id = p_school_id;
  delete from public.score_audit_log where school_id = p_school_id;

  return v_archive_id;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.classes enable row level security;
alter table public.events enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit_log enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_secrets enable row level security;
alter table public.cheer_awards enable row level security;
alter table public.event_locations enable row level security;
alter table public.school_archives enable row level security;

-- schools --------------------------------------------------------------------
-- 로그인 화면(slug로 학교 찾기)은 로그인 전이라 공개 조회가 필요하다. 이름/슬러그
-- 자체는 민감정보가 아니다.
drop policy if exists "schools_select_public" on public.schools;
create policy "schools_select_public" on public.schools
for select using (true);

drop policy if exists "schools_write_super_admin_only" on public.schools;
create policy "schools_write_super_admin_only" on public.schools
for all using (public.is_super_admin()) with check (public.is_super_admin());

-- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select using (
  auth.uid() = id
  or (public.is_admin() and school_id = public.current_school_id())
  or public.is_super_admin()
);

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin" on public.profiles
for update using (
  auth.uid() = id
  or (public.is_admin() and school_id = public.current_school_id())
  or public.is_super_admin()
) with check (
  auth.uid() = id
  or (public.is_admin() and school_id = public.current_school_id())
  or public.is_super_admin()
);

-- 본인이 role을 스스로 승격시키지 못하도록 별도 트리거로 차단 (관리자/총괄자만
-- role 변경 가능). 단, SQL Editor 등 로그인 세션이 없는 컨텍스트(auth.uid() is
-- null)에서는 예외 허용.
create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin()
     and not public.is_super_admin() then
    raise exception '권한(role) 변경은 관리자만 가능합니다';
  end if;
  return new;
end;
$$;

create or replace trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row execute function public.prevent_self_role_escalation();

-- school_id는 가입 시(handle_new_user) 한 번만 정해지고 이후 바뀔 일이 없다.
-- profiles_update_self_or_admin 정책의 "본인 행이면 통과" 조건이 school_id
-- 값 자체는 검사하지 않으므로, 이 트리거가 없으면 로그인한 사람이 본인의
-- school_id를 직접 다른 학교로 바꿔서 그 학교 데이터 전체에 접근할 수 있다
-- — 누가 됐든(총괄자 포함) UPDATE로 school_id를 바꾸는 것 자체를 막는다.
create or replace function public.prevent_school_id_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.school_id is distinct from old.school_id then
    raise exception '소속 학교(school_id)는 변경할 수 없습니다';
  end if;
  return new;
end;
$$;

create or replace trigger trg_prevent_school_id_change
before update on public.profiles
for each row execute function public.prevent_school_id_change();

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only" on public.profiles
for insert with check (public.is_admin() or public.is_super_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only" on public.profiles
for delete using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- classes ------------------------------------------------------------------
drop policy if exists "classes_select_same_school" on public.classes;
create policy "classes_select_same_school" on public.classes
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "classes_write_admin_same_school" on public.classes;
create policy "classes_write_admin_same_school" on public.classes
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- events ---------------------------------------------------------------
drop policy if exists "events_select_same_school" on public.events;
create policy "events_select_same_school" on public.events
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "events_write_admin_same_school" on public.events;
create policy "events_write_admin_same_school" on public.events
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- scores ---------------------------------------------------------------
drop policy if exists "scores_select_same_school" on public.scores;
create policy "scores_select_same_school" on public.scores
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "scores_insert_same_school" on public.scores;
create policy "scores_insert_same_school" on public.scores
for insert with check (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and auth.role() = 'authenticated'
    and (public.is_admin() or not public.event_is_locked(event_id))
  )
);

drop policy if exists "scores_update_same_school" on public.scores;
create policy "scores_update_same_school" on public.scores
for update using (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and (public.is_admin() or status = 'draft')
    and (public.is_admin() or not public.event_is_locked(event_id))
  )
) with check (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and (public.is_admin() or not public.event_is_locked(event_id))
  )
);

-- 교사는 본인이 최종 제출한(submitted_by = 자기 자신) 점수만 취소(삭제)할 수
-- 있고, 관리자는 자기 학교 점수는 아무거나 초기화할 수 있다.
drop policy if exists "scores_delete_admin_or_own_same_school" on public.scores;
create policy "scores_delete_admin_or_own_same_school" on public.scores
for delete using (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and (public.is_admin() or submitted_by = auth.uid())
  )
);

-- score_audit_log --------------------------------------------------------
-- 교사도 본인/타인의 점수 변경 이력을 볼 수 있어야 자기 취소 기능을 신뢰할 수 있다.
drop policy if exists "audit_select_same_school" on public.score_audit_log;
create policy "audit_select_same_school" on public.score_audit_log
for select using (school_id = public.current_school_id() or public.is_super_admin());

-- app_settings -------------------------------------------------------------
-- 로그인 화면(비로그인)의 학교 이름/로고 조회는 서버 코드가 서비스 롤로 직접
-- 하므로(getPublicBranding), RLS는 "내 학교 것만" 보이게 좁힌다 — 그래야 아무나
-- 전체 학교의 설정(공개 전까지 비공개였으면 하는 값 포함)을 가져가지 못한다.
drop policy if exists "app_settings_select_public" on public.app_settings;
drop policy if exists "app_settings_select_same_school" on public.app_settings;
create policy "app_settings_select_same_school" on public.app_settings
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "app_settings_write_admin_same_school" on public.app_settings;
create policy "app_settings_write_admin_same_school" on public.app_settings
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- app_secrets ----------------------------------------------------------------
drop policy if exists "app_secrets_select_admin_same_school" on public.app_secrets;
create policy "app_secrets_select_admin_same_school" on public.app_secrets
for select using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

drop policy if exists "app_secrets_write_admin_same_school" on public.app_secrets;
create policy "app_secrets_write_admin_same_school" on public.app_secrets
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- school_archives --------------------------------------------------------
drop policy if exists "school_archives_select_admin_same_school" on public.school_archives;
create policy "school_archives_select_admin_same_school" on public.school_archives
for select using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

drop policy if exists "school_archives_write_super_admin_only" on public.school_archives;
create policy "school_archives_write_super_admin_only" on public.school_archives
for all using (public.is_super_admin()) with check (public.is_super_admin());

-- cheer_awards ---------------------------------------------------------------
drop policy if exists "cheer_awards_select_same_school" on public.cheer_awards;
create policy "cheer_awards_select_same_school" on public.cheer_awards
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "cheer_awards_insert_same_school" on public.cheer_awards;
create policy "cheer_awards_insert_same_school" on public.cheer_awards
for insert with check (
  public.is_super_admin()
  or (school_id = public.current_school_id() and auth.role() = 'authenticated')
);

drop policy if exists "cheer_awards_delete_admin_same_school" on public.cheer_awards;
create policy "cheer_awards_delete_admin_same_school" on public.cheer_awards
for delete using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- event_locations ------------------------------------------------------------
drop policy if exists "event_locations_select_same_school" on public.event_locations;
create policy "event_locations_select_same_school" on public.event_locations
for select using (school_id = public.current_school_id() or public.is_super_admin());

drop policy if exists "event_locations_write_admin_same_school" on public.event_locations;
create policy "event_locations_write_admin_same_school" on public.event_locations
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

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
-- 설치 후 수동으로 해야 할 일
--
-- 1. 본인(총괄자) 계정 만들기 — Supabase Auth에서 본인 이메일로 먼저 가입/로그인한
--    뒤, 아래 YOUR_EMAIL 자리에 그 이메일을 넣어 한 번만 실행하세요.
--
--    insert into public.profiles (id, email, name, role, school_id)
--    select id, email, '총괄자', 'super_admin', null
--    from auth.users
--    where email = 'YOUR_EMAIL';
--
-- 2. 그 다음부터는 /super 화면에 로그인해서 학교를 만들고, 각 학교의 로그인
--    링크(/login/<slug>)를 해당 학교 체육부장님께 전달하면 됩니다.
-- ============================================================================
