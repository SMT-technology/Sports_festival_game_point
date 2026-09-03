-- ============================================================================
-- 최초 관리자 부트스트랩 버그 수정
--
-- 기존 prevent_self_role_escalation() 트리거는 "일반 로그인 사용자가 앱을 통해
-- 스스로를 관리자로 승격시키는 것"을 막기 위한 것이었으나, SQL Editor에서
-- 직접 실행하는 관리 작업(auth.uid()가 없는 컨텍스트)까지 막아버리는 문제가 있었음.
--
-- 수정: 로그인 세션이 없는 컨텍스트(auth.uid() is null, 즉 SQL Editor 등 DB에
-- 직접 접근하는 경우)에서는 role 변경을 허용하고, 앱을 통한 로그인 세션에서만
-- "관리자가 아니면 role을 바꿀 수 없다"는 제약을 적용한다.
-- ============================================================================

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
