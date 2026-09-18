-- ============================================================================
-- 로그인 화면 / 상단 메뉴에 학교 위치 기준 날짜·시간·날씨를 보여주기 위해,
-- 관리자가 사이트 설정에서 한 번 등록해두는 위치 정보를 추가한다.
--
-- 날씨는 API 키가 필요 없는 Open-Meteo를 클라이언트(브라우저)에서 직접
-- 호출해서 가져온다 — 위도/경도만 있으면 되므로 여기서는 좌표와 화면에
-- 보여줄 지역 이름만 저장한다. 기본값은 서울시청 좌표로 둬서, 관리자가
-- 아직 설정 전이어도 화면이 비어 보이지 않게 한다.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'weather_lat'
  ) then
    alter table public.app_settings add column weather_lat numeric not null default 37.5665;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'weather_lon'
  ) then
    alter table public.app_settings add column weather_lon numeric not null default 126.9780;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'weather_location_name'
  ) then
    alter table public.app_settings add column weather_location_name text not null default '서울';
  end if;
end $$;
