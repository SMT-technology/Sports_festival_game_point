-- ============================================================================
-- "8자 줄넘기" 종목을 입력 화면의 체육관 그룹으로 옮긴다.
--
-- 체육관/운동장 구분은 실제 category 값이 아니라 반대항전(relay) 종목들의
-- order_index 순서 중 "뒤쪽 N개"를 체육관으로 보여주는 방식이므로, 이 종목의
-- order_index를 반대항전 중 가장 큰 값으로 올려서 맨 뒤로 보낸다.
-- (이름이 정확히 일치하는 종목이 없으면 이 UPDATE는 아무 행도 바꾸지 않음)
-- ============================================================================

update public.events
set order_index = (
  select coalesce(max(order_index), 0) + 1
  from public.events
  where category = 'relay'
)
where category = 'relay' and name = '8자 줄넘기';
