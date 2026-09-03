-- ============================================================================
-- 시드 데이터: 반 목록 + 기본 종목
-- ============================================================================

-- 1학년 1~12반, 2학년 1~12반, 3학년 1~14반
insert into public.classes (grade, class_no)
select 1, gs from generate_series(1, 12) gs
union all
select 2, gs from generate_series(1, 12) gs
union all
select 3, gs from generate_series(1, 14) gs
on conflict (grade, class_no) do nothing;

-- 반대항전 6종목 (순위제: 1위 100 / 2위 80 / 3위 60 / 4위 40 / 5위 20 / 6위 이하 0)
insert into public.events (name, category, scoring_type, point_table, order_index)
select '반대항전 ' || gs || '종목', 'relay', 'rank',
       '{"1":100,"2":80,"3":60,"4":40,"5":20}'::jsonb, gs
from generate_series(1, 6) gs
on conflict (name) do nothing;

-- 단합 미니게임 7종목 (통과/실패: 통과 20점)
insert into public.events (name, category, scoring_type, pass_points, order_index)
select '단합 미니게임 ' || gs, 'minigame', 'pass_fail', 20, 100 + gs
from generate_series(1, 7) gs
on conflict (name) do nothing;

-- 응원 및 질서 점수 (직접 입력: 0~10점)
insert into public.events (name, category, scoring_type, max_points, order_index)
values ('응원 및 질서', 'cheer', 'direct', 10, 200)
on conflict (name) do nothing;
