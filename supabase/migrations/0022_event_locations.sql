-- ============================================================================
-- 종목의 "분류(장소)"를 고정된 3개(운동장/체육관/미니게임)에서, 관리자가 직접
-- 추가·수정할 수 있는 장소 목록으로 바꾼다.
--
-- 1) event_locations: 장소 목록 (이름 + 이모지). 관리자가 종목·배점 화면에서
--    자유롭게 추가/수정/삭제할 수 있다. 기본값으로 운동장/체육관/본관/신관을
--    미리 넣어둔다.
-- 2) events.category는 더 이상 'field'/'gym'/'minigame' 3개로 고정된 값이
--    아니라, event_locations.name과 같은 자유 텍스트가 된다 (엄격한 FK로
--    묶지는 않는다 — 장소 이름을 나중에 바꾸거나 지워도 이미 있는 종목의
--    분류 값 자체는 그대로 남아있게 하기 위함. 대신 화면에서는 이 텍스트로
--    event_locations를 조회해서 이모지를 찾아 보여준다).
-- ============================================================================

create table if not exists public.event_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  emoji text not null default '📍',
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.event_locations add constraint event_locations_name_not_blank
  check (length(trim(name)) > 0);

insert into public.event_locations (name, emoji, order_index) values
  ('운동장', '🏃', 0),
  ('체육관', '🏀', 1),
  ('본관', '🏫', 2),
  ('신관', '🏢', 3)
on conflict (name) do nothing;

alter table public.event_locations enable row level security;

drop policy if exists "event_locations_select_authenticated" on public.event_locations;
create policy "event_locations_select_authenticated" on public.event_locations
for select using (auth.role() = 'authenticated');

drop policy if exists "event_locations_write_admin_only" on public.event_locations;
create policy "event_locations_write_admin_only" on public.event_locations
for all using (public.is_admin()) with check (public.is_admin());

-- events.category 제약을 고정 3개 값에서 "비어있지만 않으면 됨"으로 완화
do $$
declare
  r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.events'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%category%'
  loop
    execute format('alter table public.events drop constraint %I', r.conname);
  end loop;

  alter table public.events add constraint events_category_not_blank
    check (length(trim(category)) > 0);
end $$;

-- 기존 종목들의 category 값을 새 장소 이름으로 옮겨준다
-- (field -> 운동장, gym -> 체육관, minigame -> 신관: 입력 탭에서 신관 미니게임을
--  이렇게 불러왔던 것과 동일한 매핑)
update public.events set category = '운동장' where category = 'field';
update public.events set category = '체육관' where category = 'gym';
update public.events set category = '신관' where category = 'minigame';
