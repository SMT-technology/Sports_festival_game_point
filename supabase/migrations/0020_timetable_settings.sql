-- ============================================================================
-- 시간표 이미지도 로고처럼 관리자가 사이트 설정 화면에서 URL로 바꿀 수 있게 한다.
-- 기본값은 지금까지 코드에 하드코딩되어 있던 실제 업로드 파일 경로로 둬서,
-- 이미 값을 정해둔 것처럼 보이던 기존 화면과 동작이 그대로 유지되게 한다.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'timetable_url'
  ) then
    alter table public.app_settings add column timetable_url text not null default '/sports-festival-game_TT.png';
  end if;
end $$;
