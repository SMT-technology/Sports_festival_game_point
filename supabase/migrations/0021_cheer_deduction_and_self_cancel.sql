-- ============================================================================
-- 1) 응원·질서 점수 감점 허용
--
-- 지금까지는 0~100점만 지급할 수 있었는데, 반이 갑자기 응원/질서를 안 지키는
-- 경우 감점도 줄 수 있어야 한다. points 범위를 -100~100으로 넓힌다
-- (마이너스 값을 넣으면 감점으로 누적된다 — cheer_awards 합계는 그대로
-- SUM(points)이라 감점 로직을 따로 만들 필요가 없다).
-- ============================================================================
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.cheer_awards'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%points%'
  loop
    execute format('alter table public.cheer_awards drop constraint %I', r.conname);
  end loop;

  alter table public.cheer_awards add constraint cheer_awards_points_check
    check (points >= -100 and points <= 100);
end $$;

-- ============================================================================
-- 2) 교사가 자기 자신이 최종 제출한 점수를 스스로 취소(삭제)하고 다시 입력할
--    수 있게 한다. 관리자는 지금처럼 아무 점수나 초기화할 수 있고(변경 없음),
--    일반 교사는 본인이 제출한(submitted_by = 자기 자신) 점수만 삭제 가능하다
--    — 다른 교사가 제출한 점수까지 마음대로 지울 수 있게 하면 위험하므로,
--    "내가 실수로 잘못 입력한 걸 내가 고친다"는 원래 취지로 범위를 제한한다.
-- ============================================================================
drop policy if exists "scores_delete_admin_only" on public.scores;
create policy "scores_delete_admin_or_own" on public.scores
for delete using (
  public.is_admin()
  or (auth.role() = 'authenticated' and submitted_by = auth.uid())
);

-- ============================================================================
-- 3) 점수를 삭제(취소)한 기록도 이력에 남긴다. 지금까지는 INSERT/UPDATE만
--    이력에 남았는데, 이제 교사가 직접 삭제도 할 수 있게 됐으니 "누가 언제
--    무엇을 취소했는지"도 이력에서 확인할 수 있어야 한다.
-- ============================================================================
create or replace function public.log_score_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.score_audit_log
    (score_id, event_id, class_id, action, old_data, new_data, changed_by)
  values (
    old.id, old.event_id, old.class_id, 'delete',
    to_jsonb(old), null,
    auth.uid()
  );
  return old;
end;
$$;

drop trigger if exists trg_log_score_delete on public.scores;
create trigger trg_log_score_delete
after delete on public.scores
for each row execute function public.log_score_delete();

-- ============================================================================
-- 4) 이력(score_audit_log)을 관리자뿐 아니라 교사도 볼 수 있게 한다. 교사가
--    직접 점수를 취소/재입력할 수 있게 된 만큼, 무엇이 언제 바뀌었는지
--    투명하게 볼 수 있어야 신뢰할 수 있다.
-- ============================================================================
drop policy if exists "audit_select_admin_only" on public.score_audit_log;
drop policy if exists "audit_select_authenticated" on public.score_audit_log;
create policy "audit_select_authenticated" on public.score_audit_log
for select using (auth.role() = 'authenticated');
