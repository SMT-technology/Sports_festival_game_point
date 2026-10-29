-- ============================================================================
-- 2차 보안 점검에서 발견된 문제 수정
--
-- 1. [심각] handle_new_user()가 회원가입 메타데이터(role/school_id)를
--    무조건 신뢰하던 문제
--    지금까지는 auth.users에 새 행이 생기면(= 누가 회원가입을 하면)
--    raw_user_meta_data에 적힌 role/school_id를 그대로 믿고 profiles를
--    만들었다. 이건 총괄자가 서비스 롤 키로 교사/관리자를 만들 때
--    user_metadata에 실어 보내는 값인데, 만약 Supabase 프로젝트의 이메일
--    회원가입이 켜져 있다면(기본값) 누구든 브라우저에서 직접
--    supabase.auth.signUp({ options: { data: { role: 'admin',
--    school_id: '다른학교ID' } } })을 호출해서 다른 학교의 관리자로,
--    심지어 role: 'super_admin'으로 가입해버릴 수 있었다 — 이 앱 코드는
--    회원가입 화면을 아예 제공하지 않지만, Supabase Auth API 자체는 그와
--    무관하게 켜져 있으면 누구나 호출할 수 있다.
--
--    수정: 총괄자가 교사/관리자 계정을 만들 때만 아는 "발급 비밀값"을
--    같이 실어 보내게 하고, 그 값이 일치할 때만 role/school_id 메타데이터를
--    신뢰한다. 비밀값이 없거나 틀리면 가입 자체를 거부한다(이 앱은 애초에
--    자율 회원가입을 지원하지 않으므로, 신뢰 못 할 요청은 막아버리는 게
--    맞다). 이 비밀값은 이 마이그레이션 파일에 적지 않고 DB 안에서
--    무작위로 생성한다 — 깃허브 저장소에 비밀값이 그대로 남지 않도록.
--
--    ⚠️ 그래도 가장 확실한 방법은 Supabase 대시보드에서 이메일 회원가입
--    자체를 꺼두는 것입니다 (Authentication → Sign In / Providers →
--    Email → "Allow new users to sign up" 끄기). 이 앱은 총괄자/관리자가
--    직접 계정을 만들어주는 구조라 회원가입 기능이 아예 필요 없습니다.
--
-- 2. [높음] app_settings를 아무나(비로그인 포함) 전체 학교 다 조회할 수
--    있던 문제
--    로그인 전 화면(학교 이름/로고)을 보여주려고 select using (true)로
--    열어뒀는데, 이러면 school_id 필터 없이 전체 학교의 설정(순위 공개
--    여부 같은, 발표 전에는 비공개였으면 하는 값 포함)을 아무나 가져갈 수
--    있다. 로그인 화면은 서버 코드가 이미 어느 학교인지 알고 있으므로
--    서비스 롤로 직접 조회하도록 바꾸고(이번 커밋에서 같이 수정), RLS는
--    "내 학교 것만" 보이게 좁힌다.
--
-- 3. [중간] "보관 후 초기화"가 여러 개의 분리된 요청으로 실행되던 문제
--    스냅샷을 찍고 지우는 과정이 하나의 트랜잭션이 아니어서, 그 사이에
--    실패하면 일부만 지워진 애매한 상태가 될 수 있었다. 하나의 DB 함수로
--    묶어서 원자적으로 실행되게 한다.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. 발급 비밀값 테이블 + handle_new_user() 재작성
-- ----------------------------------------------------------------------------
create table if not exists public.provisioning_secret (
  id boolean primary key default true check (id),
  secret text not null default encode(gen_random_bytes(32), 'hex')
);
insert into public.provisioning_secret (id) values (true) on conflict (id) do nothing;

alter table public.provisioning_secret enable row level security;
-- 일부러 정책을 하나도 안 만든다 — RLS는 켜져 있는데 정책이 없으면
-- 클라이언트(anon/authenticated 키)로는 어떤 요청도 통과하지 못한다.
-- 서비스 롤 키는 RLS를 우회하므로 서버 코드(계정 생성 API)에서만 읽을 수 있다.

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

  -- 관리자/총괄자 권한이나 특정 학교 소속을 요청하는 건데 비밀값이 없거나
  -- 틀리면, 신뢰할 수 없는(=서버 코드를 거치지 않은) 요청으로 보고 가장
  -- 안전한 기본값으로 강등한다.
  if (requested_role in ('admin', 'super_admin') or requested_school_id is not null)
     and (real_secret is null or provided_secret is distinct from real_secret) then
    requested_role := 'teacher';
    requested_school_id := null;
  end if;

  -- 이 앱은 자율 회원가입을 지원하지 않는다 — school_id 없는 teacher(위에서
  -- 강등됐거나 애초에 없이 들어온 경우) 가입은 통째로 거부한다.
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

-- ----------------------------------------------------------------------------
-- 2. app_settings SELECT를 "내 학교 것만"으로 좁힌다
--    (로그인 전 화면용 조회는 서버가 서비스 롤로 직접 하도록 앱 코드에서 변경)
-- ----------------------------------------------------------------------------
drop policy if exists "app_settings_select_public" on public.app_settings;
create policy "app_settings_select_same_school" on public.app_settings
for select using (school_id = public.current_school_id() or public.is_super_admin());

-- ----------------------------------------------------------------------------
-- 3. "보관 후 초기화"를 하나의 원자적 DB 함수로 묶는다
-- ----------------------------------------------------------------------------
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
