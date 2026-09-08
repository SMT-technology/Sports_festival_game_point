-- ============================================================================
-- 종목별로 대상 학년을 지정할 수 있게 한다.
--
-- 학년마다 진행하는 게임이 다를 수 있어서, 종목(events)에 "이 종목을
-- 하는 학년" 목록을 추가한다. 기본값은 1,2,3학년 전체(기존 종목과 동일한
-- 동작 유지)이고, 관리자가 특정 종목을 특정 학년에만 배정할 수 있다.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'grades'
  ) then
    alter table public.events
      add column grades smallint[] not null default '{1,2,3}';
  end if;
end $$;

alter table public.events drop constraint if exists events_grades_check;
alter table public.events add constraint events_grades_check
  check (
    array_length(grades, 1) > 0
    and grades <@ array[1, 2, 3]::smallint[]
  );
