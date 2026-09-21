-- ============================================================================
-- 교사 계정: 비밀번호를 항상 고정된 기본값(1234)으로 쓰고, 최초 로그인 시
-- 강제로 비밀번호를 바꾸게 하던 동작을 없앤다.
--
-- must_change_password 컬럼의 기본값을 true -> false로 바꾼다. 새 교사 계정은
-- auth.users에 삽입될 때 handle_new_user() 트리거가 이 기본값을 그대로 쓰므로,
-- 이제 새로 만든 교사 계정은 처음부터 강제 변경 화면을 보지 않는다.
-- (관리자로 승격시키는 경우처럼 정말 새 비밀번호가 필요한 경우엔, 그 쪽
-- 코드에서 여전히 명시적으로 must_change_password = true 를 지정한다.)
--
-- 이미 만들어져 있던 교사 계정들도 다음 로그인 때 강제 변경 화면을 보지
-- 않도록 false로 백필한다.
-- ============================================================================

alter table public.profiles alter column must_change_password set default false;

update public.profiles set must_change_password = false where role = 'teacher';
