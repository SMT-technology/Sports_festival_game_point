-- ============================================================================
-- "신관" 을 3층/4층 두 그룹으로 나누기 위해, 기존 7개 미니게임(3층 담당)에
-- 이어서 4층 담당용 미니게임 7개를 추가로 생성한다.
-- (입력 화면에서는 이 14개를 순서 기준 앞 7개=3층, 뒤 7개=4층으로 나눠 보여줌)
-- ============================================================================

insert into public.events (name, category, scoring_type, pass_points, order_index)
select
  '단합 미니게임 (4층) ' || gs,
  'minigame',
  'pass_fail',
  20,
  (select coalesce(max(order_index), 0) from public.events where category = 'minigame') + gs
from generate_series(1, 7) gs
on conflict (name) do nothing;
