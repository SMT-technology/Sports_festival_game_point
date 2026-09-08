-- ============================================================================
-- 종목 채점 방식에 "단계별 점수(tier)"를 추가한다.
--
-- 순위(rank)나 통과/실패(pass_fail)로는 표현하기 애매한 종목(예: 8자
-- 줄넘기처럼 몇 단계까지 성공했는지에 따라 차등 점수를 주는 경우)을 위해,
-- 관리자가 단계 이름과 각 단계별 점수를 자유롭게 정의할 수 있게 한다.
-- 예: [{"label":"실패","points":0},{"label":"1단계 통과","points":10},
--      {"label":"완주","points":30}]
--
-- 응원 추가 점수(bonus_points)는 이제 별도 기능(응원점수 페이지, 0017)으로
-- 옮겨가고 종합 점수에는 더 이상 합산하지 않는다(0018 아님, 이 파일에서
-- 함께 처리). scores.bonus_points 컬럼 자체는 과거 데이터 보존을 위해
-- 삭제하지 않고 남겨두되, 더 이상 사용하지 않는다.
-- ============================================================================

-- 1) events.scoring_type 허용값에 'tier' 추가 (기존 체크 제약을 이름과
--    무관하게 동적으로 찾아서 교체 — 예전 자동 생성된 이름을 확신할 수 없음)
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%scoring_type%'
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;

  alter table public.events add constraint events_scoring_type_check
    check (scoring_type in ('rank', 'pass_fail', 'direct', 'tier'));
end $$;

-- 2) events.tier_options: 단계 이름 + 점수 목록
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'tier_options'
  ) then
    alter table public.events add column tier_options jsonb not null default '[]'::jsonb;
  end if;
end $$;

-- 3) scores.tier_index: 선택된 단계의 배열 인덱스(0부터 시작)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scores' and column_name = 'tier_index'
  ) then
    alter table public.scores add column tier_index int;
  end if;
end $$;

-- 4) 점수 자동 계산 트리거: tier 분기 추가 + bonus_points를 종합 점수에서 제외
create or replace function public.compute_score_points()
returns trigger
language plpgsql
as $$
declare
  ev record;
  pts numeric;
begin
  select scoring_type, point_table, pass_points, max_points, tier_options
    into ev
    from public.events
    where id = new.event_id;

  if ev.scoring_type = 'rank' then
    if new.rank_value is null then
      pts := 0;
    else
      pts := coalesce((ev.point_table ->> new.rank_value::text)::numeric, 0);
    end if;
  elsif ev.scoring_type = 'pass_fail' then
    pts := case when new.pass_value is true then coalesce(ev.pass_points, 0) else 0 end;
  elsif ev.scoring_type = 'direct' then
    pts := coalesce(new.direct_value, 0);
    if pts < 0 or pts > ev.max_points then
      raise exception '점수(%)가 허용 범위(0~%)를 벗어났습니다', pts, ev.max_points;
    end if;
  elsif ev.scoring_type = 'tier' then
    if new.tier_index is null then
      pts := 0;
    else
      pts := coalesce((ev.tier_options -> new.tier_index ->> 'points')::numeric, 0);
    end if;
  else
    pts := 0;
  end if;

  -- 응원 추가 점수(bonus_points)는 더 이상 종합 점수에 합산하지 않음.
  -- 응원상은 별도의 cheer_awards 테이블로 집계된다(0017 마이그레이션 참고).
  new.computed_points := pts;
  new.updated_at := now();
  new.updated_by := auth.uid();

  if new.status = 'final' and (tg_op = 'INSERT' or old.status is distinct from 'final') then
    new.final_at := now();
    if new.submitted_by is null then
      new.submitted_by := auth.uid();
    end if;
  elsif new.status = 'draft' then
    new.final_at := null;
  end if;

  return new;
end;
$$;
