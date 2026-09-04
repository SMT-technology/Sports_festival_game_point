-- ============================================================================
-- 종목(events) 데이터 초기화 + 카테고리 단순화
--
-- 1) 그동안 여러 마이그레이션(시드 재실행, 4층 미니게임 추가, 반대항전
--    분리 등)을 거치며 종목 이름/데이터가 뒤섞였다. 기존 종목을 전부
--    지우고, 관리자가 "종목 이름 관리" 화면에서 직접 새로 추가한다.
--    (반 목록·교사 계정은 그대로 유지 — events만 지우고, scores는
--     event_id에 ON DELETE CASCADE가 걸려 있어 함께 자동 삭제된다)
--
-- 2) 응원 점수를 더 이상 별도의 "cheer" 카테고리로 분리하지 않는다.
--    이제 응원 점수는 그 장소(운동장 또는 체육관)의 추가 점수일 뿐이다.
--    관리자 화면에서 category를 field/gym으로, 채점 방식을 "직접 입력"
--    으로 설정해 추가하면 입력 화면에서 자동으로 그 장소의 노란 보너스
--    (응원질서 추가점수) 버튼으로 표시되고, 결과 화면에서도 그 장소
--    총점에 자연스럽게 합산된다. 신관(미니게임)에는 이 개념이 없다.
--    -> category 허용값에서 'cheer'를 제거한다.
-- ============================================================================

delete from public.events;

alter table public.events drop constraint if exists events_category_check;
alter table public.events add constraint events_category_check
  check (category in ('field', 'gym', 'minigame'));
