-- ============================================================================
-- 응원 추가 점수(0~20점)를 별도 종목이 아니라, 모든 종목의 점수 입력 화면에서
-- 반별로 함께 입력하는 방식으로 변경한다.
--
-- scores 테이블에 bonus_points 컬럼을 추가하고, 점수 자동 계산 트리거가
-- (기본 점수 + 응원 추가 점수)를 computed_points로 저장하도록 수정한다.
-- 이제 종목의 채점 방식(순위/통과·실패/직접 입력)과 무관하게 모든 종목에서
-- 이 추가 점수를 함께 넣을 수 있다.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'scores' and column_name = 'bonus_points'
  ) then
    alter table public.scores
      add column bonus_points numeric not null default 0
        check (bonus_points >= 0 and bonus_points <= 20);
  end if;
end $$;

create or replace function public.compute_score_points()
returns trigger
language plpgsql
as $$
declare
  ev record;
  pts numeric;
begin
  select scoring_type, point_table, pass_points, max_points
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
  else
    pts := 0;
  end if;

  new.computed_points := pts + coalesce(new.bonus_points, 0);
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
