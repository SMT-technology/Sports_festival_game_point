-- ============================================================================
-- 중복 종목 정리 + 재발 방지
--
-- 0002_seed.sql이 여러 번 실행되면서 종목(events)이 중복 생성된 문제를 해결한다.
-- (classes 테이블은 unique(grade, class_no) + on conflict do nothing이 있어서
--  안전했지만, events 테이블에는 같은 보호장치가 없었음)
-- ============================================================================

-- 이름이 같은 종목 중 가장 먼저 생성된 것만 남기고 나머지 삭제
-- (중복 종목에 딸린 scores/event_assignments는 FK ON DELETE CASCADE로 함께 정리됨.
--  아직 최종 제출된 점수가 없다면 데이터 손실 없이 안전하게 정리됨)
delete from public.events e
using public.events e2
where e.name = e2.name
  and e.created_at > e2.created_at;

-- 이후 같은 이름의 종목이 다시 중복 생성되지 않도록 유니크 제약 추가
-- (신규 설치 환경은 0001_schema.sql에서 이미 name에 unique가 걸려 있으므로,
--  여기서는 아직 제약이 없는 기존 환경에만 안전하게 추가한다)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'events_name_key'
  ) then
    alter table public.events add constraint events_name_key unique (name);
  end if;
end $$;
