-- ============================================================================
-- 정책 변경:
-- 1) 종목 배정(event_assignments) 제도 폐지 — 로그인한 교사는 누구나 모든
--    종목에 점수를 입력할 수 있음 (관리자가 미리 배정할 필요 없음)
-- 2) 관리자와 교사의 핵심 차이 = "최종 제출된 점수를 되돌릴 수 있는가"
--    → 교사는 status가 'draft'인 행만 수정 가능 (한번 최종 제출하면 더 이상
--      스스로 고칠 수 없고, 관리자만 되돌리거나 초기화 가능)
-- 3) 관리자가 잘못된 점수를 "초기화"(행 삭제) 할 수 있도록 DELETE 정책 추가
-- ============================================================================

drop policy if exists "scores_insert_assigned_or_admin" on public.scores;
drop policy if exists "scores_update_assigned_or_admin" on public.scores;

create policy "scores_insert_authenticated_or_admin" on public.scores
for insert with check (
  public.is_admin()
  or (auth.role() = 'authenticated' and not public.event_is_locked(event_id))
);

-- USING: 기존 행이 'draft' 상태일 때만 일반 교사가 수정 시작 가능
--        (이미 'final'인 행은 is_admin()이 아니면 애초에 대상이 되지 않음)
-- WITH CHECK: 결과로 남을 새 값에 대한 제약 (잠긴 종목이 아니어야 함)
create policy "scores_update_draft_or_admin" on public.scores
for update using (
  public.is_admin()
  or (auth.role() = 'authenticated' and status = 'draft' and not public.event_is_locked(event_id))
) with check (
  public.is_admin()
  or (auth.role() = 'authenticated' and not public.event_is_locked(event_id))
);

create policy "scores_delete_admin_only" on public.scores
for delete using (public.is_admin());
