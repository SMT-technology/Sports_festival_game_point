-- ============================================================================
-- 최초 로그인 시 비밀번호 변경 강제
--
-- 관리자가 계정을 새로 만들면 must_change_password = true 로 시작하고,
-- 로그인 직후 /change-password 로 강제 이동시킨다. 본인이 새 비밀번호로
-- 바꾸면 false 로 바뀌고, 그 이후로는 강제 이동하지 않는다.
-- 관리자가 비밀번호를 재설정(초기화)해주면 다시 true 로 돌아가 다음
-- 로그인 때 또 한 번 변경하도록 만든다.
--
-- 이미 사용 중이던 기존 계정들은 갑자기 강제 변경 화면을 보지 않도록
-- false 로 백필한다.
-- ============================================================================

alter table public.profiles
  add column must_change_password boolean not null default true;

update public.profiles set must_change_password = false;
