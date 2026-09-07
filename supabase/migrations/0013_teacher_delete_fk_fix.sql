-- ============================================================================
-- 교사 계정 삭제가 안 되던 문제 수정
--
-- scores.submitted_by / scores.updated_by / score_audit_log.changed_by가
-- profiles(id)를 참조하면서 ON DELETE 옵션이 지정되어 있지 않았다
-- (기본값 NO ACTION). 그 결과, 이미 한 번이라도 점수를 입력하거나 수정한
-- 교사 계정은 그 기록들이 이 컬럼들로 참조하고 있어서 계정 삭제 시
-- "violates foreign key constraint" 오류로 삭제가 막혔다.
--
-- 점수/이력 기록 자체는 그대로 남겨야 하므로(관리자 화면에도 "이 교사가
-- 입력한 점수 기록은 유지됩니다"라고 안내하고 있음), 계정이 삭제되면
-- 해당 컬럼만 NULL로 비우도록 ON DELETE SET NULL로 바꾼다.
-- ============================================================================

alter table public.scores drop constraint if exists scores_submitted_by_fkey;
alter table public.scores add constraint scores_submitted_by_fkey
  foreign key (submitted_by) references public.profiles(id) on delete set null;

alter table public.scores drop constraint if exists scores_updated_by_fkey;
alter table public.scores add constraint scores_updated_by_fkey
  foreign key (updated_by) references public.profiles(id) on delete set null;

alter table public.score_audit_log drop constraint if exists score_audit_log_changed_by_fkey;
alter table public.score_audit_log add constraint score_audit_log_changed_by_fkey
  foreign key (changed_by) references public.profiles(id) on delete set null;
