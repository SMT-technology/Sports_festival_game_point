-- ============================================================================
-- "반대항전"(relay) 카테고리를 "운동장"(field) / "체육관"(gym) 두 개의
-- 실제 카테고리로 분리한다.
--
-- 종목 이름은 나중에 얼마든지 바뀔 수 있으므로, 이름을 기준으로 판단하지
-- 않는다. 대신 order_index(현재 화면에 보이는 순서) 기준으로 앞쪽 3개는
-- field, 뒤쪽 2개는 gym으로 배정한다 (반대항전 총 5개 = 운동장 3 + 체육관 2).
--
-- 실행 후 순서가 의도와 다르면(예: 체육관에 들어가야 할 종목이 운동장에
-- 배정된 경우) 관리자 페이지(종목 이름 관리)에서 ⠿ 를 드래그해 순서를
-- 바꾸면 자동으로 재계산되지는 않으니, 필요하면 종목의 분류(카테고리) 자체를
-- 관리자 페이지에서 직접 다시 선택해 저장하면 된다.
-- ============================================================================

-- 1) 기존 재배정 전에 제약을 잠시 제거 (제약이 있으면 중간 상태에서 막힘)
alter table public.events drop constraint if exists events_category_check;

-- 2) order_index 기준 뒤에서 2개 = gym, 나머지 = field (이름 무관, 개수 기준)
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
