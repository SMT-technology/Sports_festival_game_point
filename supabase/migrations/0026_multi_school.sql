-- ============================================================================
-- 멀티 스쿨(여러 학교) 지원 전환
--
-- ⚠️ 이 마이그레이션은 파괴적입니다 — 지금까지 쌓인 반/종목/점수/응원점수
-- 데이터와 모든 교사·관리자 프로필(profiles)을 전부 비웁니다. 체육대회가
-- 끝난 뒤 "학교별로 완전히 분리된 시스템"으로 다시 시작하기 위한 1회성
-- 마이그레이션이라, 0001~0025처럼 안전하게 반복 실행되도록 만들지 않았습니다
-- (다시 실행하면 또 비워집니다 — 딱 한 번만 실행하세요).
--
-- 구조:
--   - 새 schools 테이블: 학교 1개 = 1행 (slug가 로그인 주소에 쓰임, 예: /login/sindo)
--   - classes/events/event_locations/scores/cheer_awards/score_audit_log에
--     school_id 컬럼 추가 — 매 insert 때 트리거가 자동으로 "로그인한 사람의
--     학교"를 채워 넣으므로, 이 테이블들을 쓰는 기존 화면 코드는 거의 그대로다.
--   - app_settings/app_secrets는 더 이상 전역 싱글턴(id=1)이 아니라
--     "학교 하나당 1행"으로 바뀐다 (PK가 school_id).
--   - profiles.role에 'super_admin'(총괄자) 추가. 총괄자는 school_id가 null —
--     특정 학교에 속하지 않고 전체를 관리한다.
--
-- 이 마이그레이션을 실행한 뒤, 본인 계정을 총괄자로 만드는 절차는 파일
-- 맨 아래 안내를 따르세요 (SQL로 직접 한 번 지정해야 합니다 — UI로는 못 만듭니다).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. 기존 데이터 비우기 (의존 관계 역순)
-- ----------------------------------------------------------------------------
-- event_assignments: 0005 마이그레이션 이후로 앱에서 전혀 쓰지 않는 레거시
-- 테이블인데, profiles를 참조하고 있어서 truncate profiles를 막는다. 더
-- 이상 쓰이지 않으므로 이번 기회에 완전히 제거한다 (school_id도 없어서
-- 그대로 뒀다간 여러 학교 교사 배정이 뒤섞이는 테이블이 되어버린다).
drop table if exists public.event_assignments cascade;
drop function if exists public.is_assigned(uuid);

drop table if exists public.score_audit_log cascade;
drop table if exists public.scores cascade;
drop table if exists public.cheer_awards cascade;
drop table if exists public.events cascade;
drop table if exists public.event_locations cascade;
drop table if exists public.classes cascade;
drop table if exists public.app_settings cascade;
drop table if exists public.app_secrets cascade;

-- profiles는 auth.users와 1:1로 묶여 있어 테이블 자체를 지우지 않고 행만 비운다
-- (교사/관리자 계정의 로그인 자체(auth.users)는 그대로 남아있지만, 프로필이
-- 없어지므로 이후 재로그인 시 "프로필 없음" 처리되어 사실상 비활성화된다).
truncate table public.profiles;

-- ----------------------------------------------------------------------------
-- 1. schools: 학교 목록
-- ----------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.schools enable row level security;

-- 로그인 화면(slug로 학교 찾기)은 로그인 전이라 공개 조회가 필요하다.
-- 이름/슬러그 자체는 민감 정보가 아니다 (지금의 app_settings 공개 조회와 동일한 원칙).
create policy "schools_select_public" on public.schools
for select using (true);

create policy "schools_write_super_admin_only" on public.schools
for all using (public.is_super_admin()) with check (public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 2. profiles: school_id 추가 + role에 super_admin 허용
-- ----------------------------------------------------------------------------
alter table public.profiles add column if not exists school_id uuid references public.schools(id);

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('teacher', 'admin', 'super_admin'));

-- 총괄자(super_admin)는 특정 학교에 속하지 않으므로 school_id가 비어 있어야 하고,
-- 교사/관리자는 반드시 학교가 있어야 한다.
alter table public.profiles drop constraint if exists profiles_school_id_matches_role;
alter table public.profiles add constraint profiles_school_id_matches_role
  check (
    (role = 'super_admin' and school_id is null)
    or (role in ('teacher', 'admin') and school_id is not null)
  );

-- ----------------------------------------------------------------------------
-- 3. 학교별 테이블 재생성 (school_id 포함)
-- ----------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  grade smallint not null check (grade in (1, 2, 3)),
  class_no smallint not null check (class_no > 0),
  created_at timestamptz not null default now(),
  unique (school_id, grade, class_no)
);

create table public.event_locations (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  emoji text not null default '📍',
  order_index int not null default 0,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.events (
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

create table public.scores (
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

create table public.score_audit_log (
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

create table public.cheer_awards (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  points numeric not null check (points >= -100 and points <= 100),
  awarded_by uuid references public.profiles(id) on delete set null,
  awarded_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4. app_settings / app_secrets: 싱글턴(id=1) → 학교당 1행
-- ----------------------------------------------------------------------------
create table public.app_settings (
  school_id uuid primary key references public.schools(id) on delete cascade,
  rankings_visible boolean not null default true,
  cheer_results_visible boolean not null default false,
  org_name text not null default '우리학교',
  logo_url text not null default '/logo.jpg',
  timetable_url text not null default '/sports-festival-game_TT.png',
  weather_lat numeric not null default 37.5665,
  weather_lon numeric not null default 126.9780,
  weather_location_name text not null default '서울',
  updated_at timestamptz not null default now()
);

create table public.app_secrets (
  school_id uuid primary key references public.schools(id) on delete cascade,
  public_results_token text not null default encode(gen_random_bytes(16), 'hex')
);

-- ----------------------------------------------------------------------------
-- 5. 헬퍼 함수
-- ----------------------------------------------------------------------------
create or replace function public.current_school_id()
returns uuid
language sql stable
security definer set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid();
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

-- 매 insert마다 "로그인한 사람의 학교"를 무조건 채워 넣는다 (클라이언트가 다른
-- school_id를 보내도 무시하고 덮어쓴다 — 다른 학교 데이터로 끼워 넣는 걸 원천 차단).
create or replace function public.set_school_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  new.school_id := public.current_school_id();
  return new;
end;
$$;

create trigger trg_set_school_id before insert on public.classes
for each row execute function public.set_school_id();
create trigger trg_set_school_id before insert on public.event_locations
for each row execute function public.set_school_id();
create trigger trg_set_school_id before insert on public.events
for each row execute function public.set_school_id();
create trigger trg_set_school_id before insert on public.scores
for each row execute function public.set_school_id();
create trigger trg_set_school_id before insert on public.score_audit_log
for each row execute function public.set_school_id();
create trigger trg_set_school_id before insert on public.cheer_awards
for each row execute function public.set_school_id();

-- scores 테이블을 새로 만들었으므로, 기존 점수 계산/감사로그 함수는 그대로
-- 남아있지만(함수는 테이블에 종속되지 않음) 트리거는 테이블과 함께 사라졌다 —
-- 새 scores 테이블에 다시 연결해야 점수 자동 계산·이력 기록이 동작한다.
create trigger trg_compute_score_points
before insert or update on public.scores
for each row execute function public.compute_score_points();

create trigger trg_log_score_change
after insert or update on public.scores
for each row execute function public.log_score_change();

create trigger trg_log_score_delete
after delete on public.scores
for each row execute function public.log_score_delete();

-- 신규 가입(auth.users insert) 시 profiles 행 자동 생성 — 이제 user_metadata로
-- 넘어온 school_id/role도 같이 반영한다 (관리자가 교사를 만들거나, 총괄자가
-- 새 학교의 첫 관리자를 만들 때 서버 코드에서 이 메타데이터를 채워 보낸다).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name, role, school_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.email),
    coalesce(new.raw_user_meta_data ->> 'role', 'teacher'),
    nullif(new.raw_user_meta_data ->> 'school_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS 재설정
-- ----------------------------------------------------------------------------
alter table public.classes enable row level security;
alter table public.event_locations enable row level security;
alter table public.events enable row level security;
alter table public.scores enable row level security;
alter table public.score_audit_log enable row level security;
alter table public.cheer_awards enable row level security;
alter table public.app_settings enable row level security;
alter table public.app_secrets enable row level security;

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

drop policy if exists "profiles_insert_admin_only" on public.profiles;
create policy "profiles_insert_admin_only" on public.profiles
for insert with check (public.is_admin() or public.is_super_admin());

drop policy if exists "profiles_delete_admin_only" on public.profiles;
create policy "profiles_delete_admin_only" on public.profiles
for delete using (
  (public.is_admin() and school_id = public.current_school_id())
  or public.is_super_admin()
);

-- classes ------------------------------------------------------------------
create policy "classes_select_same_school" on public.classes
for select using (school_id = public.current_school_id() or public.is_super_admin());

create policy "classes_write_admin_same_school" on public.classes
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- event_locations ------------------------------------------------------------
create policy "event_locations_select_same_school" on public.event_locations
for select using (school_id = public.current_school_id() or public.is_super_admin());

create policy "event_locations_write_admin_same_school" on public.event_locations
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- events ---------------------------------------------------------------
create policy "events_select_same_school" on public.events
for select using (school_id = public.current_school_id() or public.is_super_admin());

create policy "events_write_admin_same_school" on public.events
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- scores ---------------------------------------------------------------
create policy "scores_select_same_school" on public.scores
for select using (school_id = public.current_school_id() or public.is_super_admin());

create policy "scores_insert_same_school" on public.scores
for insert with check (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and auth.role() = 'authenticated'
    and not public.event_is_locked(event_id)
  )
);

create policy "scores_update_same_school" on public.scores
for update using (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and (public.is_admin() or status = 'draft')
    and not public.event_is_locked(event_id)
  )
) with check (
  public.is_super_admin()
  or (school_id = public.current_school_id() and not public.event_is_locked(event_id))
);

-- 교사는 본인이 최종 제출한(submitted_by = 자기 자신) 점수만 취소(삭제)할 수 있고,
-- 관리자는 자기 학교 점수는 아무거나 초기화할 수 있다.
create policy "scores_delete_admin_or_own_same_school" on public.scores
for delete using (
  public.is_super_admin()
  or (
    school_id = public.current_school_id()
    and (public.is_admin() or submitted_by = auth.uid())
  )
);

-- score_audit_log --------------------------------------------------------
create policy "audit_select_same_school" on public.score_audit_log
for select using (school_id = public.current_school_id() or public.is_super_admin());

-- cheer_awards ---------------------------------------------------------------
create policy "cheer_awards_select_same_school" on public.cheer_awards
for select using (school_id = public.current_school_id() or public.is_super_admin());

create policy "cheer_awards_insert_same_school" on public.cheer_awards
for insert with check (
  public.is_super_admin()
  or (school_id = public.current_school_id() and auth.role() = 'authenticated')
);

create policy "cheer_awards_delete_admin_same_school" on public.cheer_awards
for delete using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- app_settings -------------------------------------------------------------
-- 로그인 화면에서 비로그인 상태로도 학교 이름/로고를 봐야 하므로 공개 조회 허용
-- (지금까지도 그랬던 것과 동일한 원칙 — 브랜딩 자체는 민감정보가 아님).
create policy "app_settings_select_public" on public.app_settings
for select using (true);

create policy "app_settings_write_admin_same_school" on public.app_settings
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- app_secrets ----------------------------------------------------------------
create policy "app_secrets_select_admin_same_school" on public.app_secrets
for select using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

create policy "app_secrets_write_admin_same_school" on public.app_secrets
for all using (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
) with check (
  (public.is_admin() and school_id = public.current_school_id()) or public.is_super_admin()
);

-- ----------------------------------------------------------------------------
-- 7. Realtime (테이블을 새로 만들었으므로 발행 목록에 다시 추가)
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.scores;
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.app_settings;
alter publication supabase_realtime add table public.cheer_awards;

-- ============================================================================
-- 실행 후 수동으로 해야 할 일
--
-- 1. 본인(총괄자) 계정 만들기 — 기존에 로그인하던 이메일 그대로 써도 됩니다.
--    아래 YOUR_EMAIL 자리에 본인 이메일을 넣어 한 번만 실행하세요.
--
--    insert into public.profiles (id, email, name, role, school_id)
--    select id, email, '총괄자', 'super_admin', null
--    from auth.users
--    where email = 'YOUR_EMAIL';
--
-- 2. 그 다음부터는 /super 화면에 로그인해서 학교를 만들고, 각 학교의 로그인
--    링크(/login/<slug>)를 해당 학교 체육부장님께 전달하면 됩니다.
-- ============================================================================
