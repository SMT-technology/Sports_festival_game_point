-- ============================================================================
-- 멀티 스쿨 전환(0026) 이후 코드 리뷰에서 발견된 안전성 보강
--
-- 1. [심각] profiles 본인 수정 정책의 구멍 막기
--    profiles_update_self_or_admin 정책은 "본인 행이면" 어떤 컬럼이든 바꿀 수
--    있게 WITH CHECK가 auth.uid() = id 하나로 통과된다. role은 별도 트리거
--    (trg_prevent_self_role_escalation)로 막아뒀지만, school_id는 아무 보호가
--    없어서 로그인한 교사/관리자가 브라우저 콘솔에서 직접
--    supabase.from('profiles').update({ school_id: '다른학교ID' })를 호출하면
--    본인을 다른 학교 소속으로 바꿔치기할 수 있었다 — current_school_id()가
--    그 학교를 가리키게 되므로 그 학교의 모든 반/종목/점수/응원점수/설정에
--    읽기·쓰기가 가능해지는 심각한 테넌트 격리 붕괴다.
--    → school_id는 애초에 가입 시(handle_new_user) 한 번만 정해지고 이후
--      바뀔 일이 없으므로, 누가 됐든(총괄자 포함) UPDATE로 바꾸는 것 자체를
--      트리거로 완전히 막는다.
--
-- 2. 관리자의 "잠긴 종목" 점수 입력 우회 복원
--    0005에서는 is_admin()이면 event_is_locked() 체크를 건너뛸 수 있었는데,
--    0026에서 정책을 다시 쓰면서 이 예외가 빠지고 super_admin만 우회가
--    가능하게 좁혀졌다. 지금은 is_locked를 켜는 UI가 없어 실질적 영향은
--    없지만, 이후 다시 쓰일 수 있으니 기존 동작대로 복원한다.
--
-- 3. scores/cheer_awards의 class_id·event_id가 실제로 같은 학교 소속인지
--    검증하는 트리거 추가 (지금까지는 단순 FK만 있어서, 만약 다른 학교의
--    class_id/event_id를 알아내 집어넣으면 school_id는 내 학교인데 내용은
--    남의 학교 반/종목을 가리키는 행이 만들어질 수 있었다).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. school_id 변경 자체를 막는다
-- ----------------------------------------------------------------------------
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

drop trigger if exists trg_prevent_school_id_change on public.profiles;
create trigger trg_prevent_school_id_change
before update on public.profiles
for each row execute function public.prevent_school_id_change();

-- ----------------------------------------------------------------------------
-- 2. scores insert/update 정책 재작성 (관리자의 잠금 우회 복원)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. scores / cheer_awards의 class_id·event_id가 같은 학교 소속인지 검증
-- ----------------------------------------------------------------------------
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

-- 트리거 이름이 set_school_id보다 알파벳상 뒤라서(trg_set_school_id <
-- trg_verify_same_school_reference), school_id가 먼저 채워진 뒤에 이 검증이
-- 실행된다.
drop trigger if exists trg_verify_same_school_reference on public.scores;
create trigger trg_verify_same_school_reference
before insert or update on public.scores
for each row execute function public.verify_same_school_reference();

drop trigger if exists trg_verify_same_school_reference on public.cheer_awards;
create trigger trg_verify_same_school_reference
before insert or update on public.cheer_awards
for each row execute function public.verify_same_school_reference();
