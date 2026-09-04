-- ============================================================================
-- "반대항전"(relay) 카테고리를 "운동장"(field) / "체육관"(gym) 두 개의
-- 실제 카테고리로 분리한다. 지금까지는 입력 화면에서만 순서 기준으로
-- 임시로 나눠 보여줬는데, 이제 관리자 화면(종목 이름 관리)에서도 두 개의
-- 독립된 분류로 관리할 수 있도록 데이터 자체를 나눈다.
--
-- 기존 relay 종목 중 order_index 기준 뒤쪽 2개는 gym, 나머지는 field로
-- 재배정한다 (지금까지 입력 화면에 보이던 것과 동일한 기준).
-- ============================================================================

-- 1) 기존 재배정 전에 제약을 잠시 제거 (제약이 있으면 중간 상태에서 막힘)
alter table public.events drop constraint events_category_check;

-- 2) order_index 기준 뒤에서 2개 = gym, 나머지 = field
with ranked as (
  select id, row_number() over (order by order_index desc) as rn_from_end
  from public.events
  where category = 'relay'
)
update public.events e
set category = case when r.rn_from_end <= 2 then 'gym' else 'field' end
from ranked r
where e.id = r.id;

-- 3) 새 허용값으로 제약 재생성 (relay 대신 field/gym)
alter table public.events add constraint events_category_check
  check (category in ('field', 'gym', 'minigame', 'cheer'));
