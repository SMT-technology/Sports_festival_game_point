-- ============================================================================
-- 학교별로 체육대회를 학년 단위로 운영할 수 있게, 학교별로 "쓰는 학년"을
-- 정할 수 있는 app_settings.active_grades 컬럼을 추가한다.
-- 실제 반/종목/점수 테이블의 grade 범위(1~3)는 그대로 두고, 관리자 화면의
-- "반 관리"에서 학년 섹션을 보이거나 숨기는 데에만 쓰는 설정값이다.
-- ============================================================================

alter table public.app_settings
  add column if not exists active_grades smallint[] not null default '{1,2,3}';

alter table public.app_settings
  add constraint app_settings_active_grades_check
  check (
    array_length(active_grades, 1) > 0
    and active_grades <@ array[1, 2, 3]::smallint[]
  );
