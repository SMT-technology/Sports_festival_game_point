-- ============================================================================
-- 응원상 결과 공개 여부를 순위(rankings_visible)와 별도로 관리자가 제어할 수
-- 있게 한다. 응원상은 종합 순위와 시상 시점이 다를 수 있어서 독립적으로
-- 공개/비공개를 정할 수 있어야 한다. 기본값은 비공개(false).
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'app_settings' and column_name = 'cheer_results_visible'
  ) then
    alter table public.app_settings add column cheer_results_visible boolean not null default false;
  end if;
end $$;
