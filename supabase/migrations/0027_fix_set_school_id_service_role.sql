-- ============================================================================
-- set_school_id() 트리거 수정: 서비스 롤(service role) 키로 서버에서 직접
-- insert할 때 school_id가 null로 덮어써지던 버그 수정
--
-- 0026에서 만든 set_school_id()는 매 insert마다 무조건
-- new.school_id := public.current_school_id() 로 덮어썼다. 이건 로그인한
-- 교사/관리자가 다른 학교의 school_id를 보내도 막기 위한 의도였는데,
-- "/super/schools"에서 총괄자가 새 학교를 만들 때 기본 반(classes)/장소
-- (event_locations)를 서비스 롤 키로 직접 insert하는 경우까지 똑같이
-- 적용돼버렸다. 서비스 롤 요청은 로그인한 사용자가 없어 auth.uid()가
-- null이고, current_school_id()도 null을 돌려주는데, 트리거가 그 null로
-- school_id를 덮어써서 not null 제약에 걸려 insert가 실패했다
-- (총괄자 화면에서 "학교 추가"가 끝없이 "만드는 중..."에 멈춰있던 원인).
--
-- 수정: current_school_id()가 null이 아닐 때만(= 로그인한 교사/관리자의
-- 요청일 때만) 덮어쓰고, null이면(= 서비스 롤로 서버가 직접 넣는 경우)
-- 호출자가 지정한 school_id를 그대로 둔다. 서비스 롤 키는 우리 서버
-- 코드에서만 쓰이므로 이 경로로 다른 학교에 데이터를 끼워 넣을 수 있는
-- 건 아니다.
-- ============================================================================
create or replace function public.set_school_id()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if public.current_school_id() is not null then
    new.school_id := public.current_school_id();
  end if;
  return new;
end;
$$;
