"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { groupEventsByLocation, locationStyle, sortLocations } from "@/lib/scoring";
import type { EventLocation, EventRow, ScoringType, TierOption } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const DEFAULT_LOCATION_EMOJI = "📍";

// 장소 이모지는 자유 입력 대신, 학교 시설/체육대회 장소와 어울리는 몇 개만
// 골라서 그 안에서 고르게 한다 (이모지 키보드를 다 뒤질 필요 없게).
const LOCATION_EMOJI_OPTIONS = [
  "🏃", "🏀", "🏫", "🏢", "🏟️", "🏛️", "🎪", "🏠",
  "🏞️", "⚽", "🏸", "🏊", "🎭", "🎵", "📚", "🍽️",
  "🚗", "🌳", "🎯", "📍",
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="이모지 선택"
        className="flex h-9 w-12 items-center justify-center rounded-lg border border-slate-300 text-lg hover:bg-slate-50"
      >
        {value || DEFAULT_LOCATION_EMOJI}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 z-20 mt-1 grid w-56 grid-cols-5 gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
            {LOCATION_EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onChange(emoji);
                  setOpen(false);
                }}
                className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100 ${
                  emoji === value ? "bg-blue-50 ring-1 ring-blue-400" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CategorySelect({
  value,
  locations,
  onChange,
  className,
}: {
  value: string;
  locations: EventLocation[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const known = locations.some((l) => l.name === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {!known && value && <option value={value}>{value} (장소 목록에 없음)</option>}
      {sortLocations(locations).map((loc) => (
        <option key={loc.id} value={loc.name}>
          {loc.emoji} {loc.name}
        </option>
      ))}
    </select>
  );
}

function ScoringTypeSelect({
  value,
  onChange,
  className,
}: {
  value: ScoringType;
  onChange: (value: ScoringType) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ScoringType)}
      className={className}
    >
      {value === "direct" && <option value="direct">직접 입력 (레거시)</option>}
      <option value="rank">순위 배점</option>
      <option value="pass_fail">통과/실패</option>
      <option value="tier">사용자 설정 점수</option>
    </select>
  );
}

export function EventsClient({
  initialEvents,
  initialLocations,
}: {
  initialEvents: EventRow[];
  initialLocations: EventLocation[];
}) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [locations, setLocations] = useState<EventLocation[]>(initialLocations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<Set<string>>(new Set());
  const [dragSource, setDragSource] = useState<{ locationName: string; index: number } | null>(
    null,
  );

  // 장소 관리 -----------------------------------------------------------------
  const [locationDrafts, setLocationDrafts] = useState<
    Record<string, { name: string; emoji: string }>
  >({});
  const [locationBusyId, setLocationBusyId] = useState<string | null>(null);
  const [locationDeleteTarget, setLocationDeleteTarget] = useState<EventLocation | null>(null);
  const [newLocation, setNewLocation] = useState({ name: "", emoji: DEFAULT_LOCATION_EMOJI });
  const [locationCreating, setLocationCreating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  function locationDraft(loc: EventLocation) {
    return locationDrafts[loc.id] ?? { name: loc.name, emoji: loc.emoji };
  }

  function setLocationDraft(id: string, patch: Partial<{ name: string; emoji: string }>) {
    setLocationDrafts((prev) => ({
      ...prev,
      [id]: { ...(prev[id] ?? locations.find((l) => l.id === id)!), ...patch },
    }));
  }

  async function saveLocation(loc: EventLocation) {
    const draft = locationDraft(loc);
    if (!draft.name.trim()) return;
    setLocationBusyId(loc.id);
    setLocationError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("event_locations")
      .update({ name: draft.name.trim(), emoji: draft.emoji.trim() || DEFAULT_LOCATION_EMOJI })
      .eq("id", loc.id);
    setLocationBusyId(null);
    if (error) {
      setLocationError("저장 실패: " + error.message);
      return;
    }
    const renamedFrom = loc.name;
    const renamedTo = draft.name.trim();
    setLocations((prev) =>
      prev.map((l) =>
        l.id === loc.id ? { ...l, name: renamedTo, emoji: draft.emoji.trim() || DEFAULT_LOCATION_EMOJI } : l,
      ),
    );
    // 이름이 바뀌면, 이미 이 장소를 쓰고 있던 종목들의 category 값도 함께 맞춰준다
    // (그렇지 않으면 종목들은 예전 이름을 그대로 들고 있어서 목록에서 떨어져 나간다).
    if (renamedFrom !== renamedTo) {
      const affected = events.filter((ev) => ev.category === renamedFrom);
      if (affected.length > 0) {
        await supabase.from("events").update({ category: renamedTo }).eq("category", renamedFrom);
        setEvents((prev) =>
          prev.map((ev) => (ev.category === renamedFrom ? { ...ev, category: renamedTo } : ev)),
        );
      }
    }
    setLocationDrafts((prev) => {
      const next = { ...prev };
      delete next[loc.id];
      return next;
    });
  }

  async function createLocation() {
    if (!newLocation.name.trim()) return;
    setLocationCreating(true);
    setLocationError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("event_locations")
      .insert({
        name: newLocation.name.trim(),
        emoji: newLocation.emoji.trim() || DEFAULT_LOCATION_EMOJI,
        order_index: locations.length,
      })
      .select()
      .single();
    setLocationCreating(false);
    if (error) {
      setLocationError(
        error.message.toLowerCase().includes("duplicate")
          ? "이미 있는 장소 이름이에요."
          : "추가 실패: " + error.message,
      );
      return;
    }
    setLocations((prev) => [...prev, data as EventLocation]);
    setNewLocation({ name: "", emoji: DEFAULT_LOCATION_EMOJI });
  }

  async function deleteLocation() {
    if (!locationDeleteTarget) return;
    setLocationBusyId(locationDeleteTarget.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("event_locations")
      .delete()
      .eq("id", locationDeleteTarget.id);
    setLocationBusyId(null);
    if (error) {
      setLocationError("삭제 실패: " + error.message);
      setLocationDeleteTarget(null);
      return;
    }
    setLocations((prev) => prev.filter((l) => l.id !== locationDeleteTarget.id));
    setLocationDeleteTarget(null);
  }

  const locationInUseCount = (loc: EventLocation) =>
    events.filter((ev) => ev.category === loc.name).length;

  // 종목 관리 -------------------------------------------------------------------
  function toggleAdvanced(id: string) {
    setAdvancedOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [newEvent, setNewEvent] = useState<{
    name: string;
    category: string;
    scoring_type: ScoringType;
    grades: number[];
  }>({ name: "", category: initialLocations[0]?.name ?? "", scoring_type: "rank", grades: [1, 2, 3] });
  const [creating, setCreating] = useState(false);

  function toggleGradeIn(grades: number[], grade: number): number[] {
    const has = grades.includes(grade);
    if (has && grades.length === 1) return grades; // 최소 1개 학년은 남겨둠
    return has ? grades.filter((g) => g !== grade) : [...grades, grade].sort();
  }

  const groups = useMemo(() => groupEventsByLocation(events, locations), [events, locations]);

  function patchLocal(id: string, patch: Partial<EventRow>) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  // 저장 = 설정 저장 + 이미 제출된 점수에 배점표 변경사항 즉시 재적용을 한 번에 처리
  async function saveEvent(ev: EventRow) {
    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("events")
      .update({
        name: ev.name,
        category: ev.category,
        scoring_type: ev.scoring_type,
        order_index: ev.order_index,
        is_active: ev.is_active,
        is_locked: ev.is_locked,
        point_table: ev.point_table,
        pass_points: ev.pass_points,
        max_points: ev.max_points,
        grades: ev.grades,
        tier_options: ev.tier_options,
      })
      .eq("id", ev.id);

    if (error) {
      setBusyId(null);
      alert("저장 실패: " + error.message);
      return;
    }

    // 배점표 등 변경사항을 이미 제출된 점수에도 바로 반영되도록 재계산 트리거
    await supabase
      .from("scores")
      .update({ updated_at: new Date().toISOString() })
      .eq("event_id", ev.id);

    setBusyId(null);
  }

  async function deleteEvent() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    const supabase = createClient();
    const { error } = await supabase.from("events").delete().eq("id", deleteTarget.id);
    setBusyId(null);
    setDeleteTarget(null);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== deleteTarget.id));
  }

  async function createEvent() {
    if (!newEvent.name.trim() || !newEvent.category.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const sameLocationCount = events.filter((e) => e.category === newEvent.category).length;
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: newEvent.name.trim(),
        category: newEvent.category,
        scoring_type: newEvent.scoring_type,
        grades: newEvent.grades,
        order_index: sameLocationCount + 1,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      alert("추가 실패: " + error.message);
      return;
    }
    setEvents((prev) => [...prev, data as EventRow]);
    setNewEvent({
      name: "",
      category: newEvent.category,
      scoring_type: "rank",
      grades: [1, 2, 3],
    });
  }

  function updatePointTable(ev: EventRow, rank: number, value: number) {
    patchLocal(ev.id, { point_table: { ...ev.point_table, [rank]: value } });
  }

  function addRankSlot(ev: EventRow) {
    const keys = Object.keys(ev.point_table)
      .map(Number)
      .filter((n) => !Number.isNaN(n));
    const next = (keys.length ? Math.max(...keys) : 0) + 1;
    patchLocal(ev.id, { point_table: { ...ev.point_table, [next]: 0 } });
  }

  function addTierOption(ev: EventRow) {
    patchLocal(ev.id, { tier_options: [...ev.tier_options, { label: "", points: 0 }] });
  }

  function updateTierOption(ev: EventRow, index: number, patch: Partial<TierOption>) {
    const next = ev.tier_options.map((t, i) => (i === index ? { ...t, ...patch } : t));
    patchLocal(ev.id, { tier_options: next });
  }

  function removeTierOption(ev: EventRow, index: number) {
    patchLocal(ev.id, { tier_options: ev.tier_options.filter((_, i) => i !== index) });
  }

  function handleDragStart(locationName: string, index: number) {
    setDragSource({ locationName, index });
  }

  async function handleDrop(locationName: string, index: number) {
    const source = dragSource;
    setDragSource(null);
    if (!source || source.locationName !== locationName || source.index === index) return;

    const group = groups.find((g) => g.name === locationName);
    const list = [...(group?.events ?? [])];
    const [moved] = list.splice(source.index, 1);
    list.splice(index, 0, moved);

    const updates = list.map((ev, i) => ({ id: ev.id, order_index: i }));
    setEvents((prev) =>
      prev.map((e) => {
        const u = updates.find((x) => x.id === e.id);
        return u ? { ...e, order_index: u.order_index } : e;
      }),
    );

    const supabase = createClient();
    await Promise.all(
      updates.map((u) =>
        supabase.from("events").update({ order_index: u.order_index }).eq("id", u.id),
      ),
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">🏷️ 종목 이름 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          종목 이름·분류(장소)·채점 방식·대상 학년을 바로 수정할 수 있어요. 1/2/3 버튼을 눌러
          이 종목을 하는 학년을 정하세요(여러 학년 선택 가능) — 선택 안 된 학년의 교사에게는
          입력 화면에 이 종목이 아예 보이지 않아요. 왼쪽 ⠿ 을 드래그하면 순서를 바꿀 수 있고,
          배점표 등 세부 설정은 &ldquo;고급 설정&rdquo;에서 바꿀 수 있어요.
        </p>
        <p className="mt-1 text-xs text-amber-600">
          ⚠️ 이미 점수가 제출된 종목의 채점 방식을 바꾸면, 저장 시 기존 점수가 새 방식에 맞지
          않아 0점으로 재계산될 수 있어요 — 되도록 점수 입력 전에만 바꿔주세요.
        </p>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">📍 장소 관리</p>
        <p className="mb-3 text-xs text-slate-400">
          여기 있는 장소들이 아래 종목 추가/수정 화면의 &ldquo;분류&rdquo; 선택지가 돼요. 운동장·
          체육관·본관·신관 외에 원하는 장소를 자유롭게 추가하고, 이모지도 직접 정할 수 있어요.
        </p>
        <div className="space-y-2">
          {sortLocations(locations).map((loc) => {
            const draft = locationDraft(loc);
            const changed = draft.name !== loc.name || draft.emoji !== loc.emoji;
            const inUse = locationInUseCount(loc);
            return (
              <div key={loc.id} className="flex flex-wrap items-center gap-2">
                <EmojiPicker
                  value={draft.emoji}
                  onChange={(emoji) => setLocationDraft(loc.id, { emoji })}
                />
                <input
                  value={draft.name}
                  onChange={(e) => setLocationDraft(loc.id, { name: e.target.value })}
                  className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium"
                />
                <span className="text-xs text-slate-400">
                  {inUse > 0 ? `종목 ${inUse}개에서 사용 중` : "사용하는 종목 없음"}
                </span>
                {changed && (
                  <button
                    onClick={() => saveLocation(loc)}
                    disabled={locationBusyId === loc.id}
                    className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    저장
                  </button>
                )}
                <button
                  onClick={() => setLocationDeleteTarget(loc)}
                  disabled={locationBusyId === loc.id}
                  className="ml-auto rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
          <div>
            <label className="block text-xs text-slate-500">이모지</label>
            <div className="mt-1">
              <EmojiPicker
                value={newLocation.emoji}
                onChange={(emoji) => setNewLocation((s) => ({ ...s, emoji }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500">새 장소 이름</label>
            <input
              value={newLocation.name}
              onChange={(e) => setNewLocation((s) => ({ ...s, name: e.target.value }))}
              placeholder="예: 강당"
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={createLocation}
            disabled={locationCreating}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            + 장소 추가
          </button>
        </div>
        {locationError && <p className="mt-2 text-xs text-red-600">{locationError}</p>}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">새 종목 추가</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500">종목명</label>
            <input
              value={newEvent.name}
              onChange={(e) => setNewEvent((s) => ({ ...s, name: e.target.value }))}
              className="mt-1 w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              placeholder="예: 줄다리기"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">분류(장소)</label>
            <CategorySelect
              value={newEvent.category}
              locations={locations}
              onChange={(category) => setNewEvent((s) => ({ ...s, category }))}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">채점 방식</label>
            <ScoringTypeSelect
              value={newEvent.scoring_type}
              onChange={(scoring_type) => setNewEvent((s) => ({ ...s, scoring_type }))}
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500">대상 학년</label>
            <div className="mt-1 flex gap-1">
              {[1, 2, 3].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setNewEvent((s) => ({ ...s, grades: toggleGradeIn(s.grades, g) }))
                  }
                  className={`rounded-lg border px-2.5 py-1.5 text-sm font-semibold ${
                    newEvent.grades.includes(g)
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-300 text-slate-400"
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={createEvent}
            disabled={creating || !newEvent.category}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          💡 응원/질서 점수는 이제 이 화면이 아니라 별도의 &ldquo;🎉 응원점수&rdquo; 메뉴에서
          반마다 버튼을 눌러 누적으로 지급해요. 여기서는 종목별 순위/통과 점수만 관리하면
          됩니다.
        </p>
      </div>

      {groups.map((group, groupIndex) => {
        const list = group.events;
        const style = locationStyle(groupIndex);
        return (
          <div key={group.name}>
            <h2 className="mb-2 text-sm font-bold text-slate-700">
              {group.emoji} {group.name}
            </h2>
            <div className="space-y-3">
              {list.map((ev, index) => {
                const isOpen = advancedOpen.has(ev.id);
                const isDragging =
                  dragSource?.locationName === group.name && dragSource.index === index;
                return (
                  <div
                    key={ev.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(group.name, index)}
                    className={`rounded-xl border bg-white p-4 transition ${
                      isDragging ? "border-blue-400 opacity-50" : `border-slate-200 ${style.border}`
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        draggable
                        onDragStart={() => handleDragStart(group.name, index)}
                        title="드래그해서 순서 변경"
                        className="cursor-grab select-none px-1 text-lg text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                      >
                        ⠿
                      </span>
                      <input
                        value={ev.name}
                        onChange={(e) => patchLocal(ev.id, { name: e.target.value })}
                        className="w-56 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
                      />
                      <CategorySelect
                        value={ev.category}
                        locations={locations}
                        onChange={(category) => patchLocal(ev.id, { category })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <ScoringTypeSelect
                        value={ev.scoring_type}
                        onChange={(scoring_type) => patchLocal(ev.id, { scoring_type })}
                        className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      <div className="flex gap-1" title="대상 학년">
                        {[1, 2, 3].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => patchLocal(ev.id, { grades: toggleGradeIn(ev.grades, g) })}
                            className={`h-7 w-7 rounded-lg border text-xs font-semibold ${
                              ev.grades.includes(g)
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-slate-300 text-slate-400"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => saveEvent(ev)}
                        disabled={busyId === ev.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => toggleAdvanced(ev.id)}
                        className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        {isOpen ? "고급 설정 접기 ▲" : "고급 설정 ▼"}
                      </button>
                    </div>

                    {isOpen && (
                      <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-1.5 text-xs text-slate-500">
                            <input
                              type="checkbox"
                              checked={ev.is_active}
                              onChange={(e) => patchLocal(ev.id, { is_active: e.target.checked })}
                            />
                            활성화
                          </label>
                          <button
                            onClick={() => setDeleteTarget(ev)}
                            className="ml-auto rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>

                        {ev.scoring_type === "rank" && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-400">
                              순위별 점수 (표에 없는 순위는 0점) — 저장을 눌러야 반영됩니다
                            </span>
                            {Object.entries(ev.point_table)
                              .sort((a, b) => Number(a[0]) - Number(b[0]))
                              .map(([rank, pts]) => (
                                <label key={rank} className="flex items-center gap-1 text-xs">
                                  {rank}위
                                  <input
                                    type="number"
                                    value={pts}
                                    onChange={(e) =>
                                      updatePointTable(ev, Number(rank), Number(e.target.value))
                                    }
                                    className="w-16 rounded-lg border border-slate-300 px-2 py-1"
                                  />
                                </label>
                              ))}
                            <button
                              onClick={() => addRankSlot(ev)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              + 순위 추가
                            </button>
                          </div>
                        )}
                        {ev.scoring_type === "pass_fail" && (
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            통과 시 점수
                            <input
                              type="number"
                              value={ev.pass_points}
                              onChange={(e) =>
                                patchLocal(ev.id, { pass_points: Number(e.target.value) })
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                            />
                          </label>
                        )}
                        {ev.scoring_type === "direct" && (
                          <label className="flex items-center gap-2 text-xs text-slate-500">
                            최대 점수
                            <input
                              type="number"
                              value={ev.max_points}
                              onChange={(e) =>
                                patchLocal(ev.id, { max_points: Number(e.target.value) })
                              }
                              className="w-20 rounded-lg border border-slate-300 px-2 py-1"
                            />
                          </label>
                        )}
                        {ev.scoring_type === "tier" && (
                          <div className="space-y-2">
                            <span className="text-xs text-slate-400">
                              단계 이름과 점수 (저장을 눌러야 반영됩니다) — 이미 입력된 점수의
                              순서가 꼬이지 않도록, 삭제는 맨 마지막에 추가한 단계만 가능해요.
                            </span>
                            {ev.tier_options.length === 0 && (
                              <p className="text-xs text-amber-600">
                                아직 단계가 없어요. &ldquo;+ 단계 추가&rdquo;로 만들어주세요.
                              </p>
                            )}
                            {ev.tier_options.map((t, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <input
                                  value={t.label}
                                  onChange={(e) =>
                                    updateTierOption(ev, i, { label: e.target.value })
                                  }
                                  placeholder={`단계 ${i + 1} 이름 (예: 완주)`}
                                  className="w-48 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                />
                                <input
                                  type="number"
                                  value={t.points}
                                  onChange={(e) =>
                                    updateTierOption(ev, i, { points: Number(e.target.value) })
                                  }
                                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs"
                                />
                                <span className="text-xs text-slate-400">점</span>
                                {i === ev.tier_options.length - 1 && (
                                  <button
                                    onClick={() => removeTierOption(ev, i)}
                                    className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                  >
                                    삭제
                                  </button>
                                )}
                              </div>
                            ))}
                            <button
                              onClick={() => addTierOption(ev)}
                              className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                            >
                              + 단계 추가
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {list.length === 0 && (
                <p className="text-sm text-slate-400">등록된 종목이 없습니다.</p>
              )}
            </div>
          </div>
        );
      })}

      <ConfirmDialog
        open={!!deleteTarget}
        title={`'${deleteTarget?.name}' 종목을 삭제하시겠습니까?`}
        description="해당 종목의 모든 제출 점수와 배정 정보가 함께 삭제되며 되돌릴 수 없습니다."
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={deleteEvent}
        loading={busyId === deleteTarget?.id}
      />

      <ConfirmDialog
        open={!!locationDeleteTarget}
        title={`'${locationDeleteTarget?.name}' 장소를 삭제하시겠습니까?`}
        description={
          locationDeleteTarget && locationInUseCount(locationDeleteTarget) > 0
            ? `이 장소를 쓰는 종목이 ${locationInUseCount(locationDeleteTarget)}개 있어요. 종목의 분류 값 자체는 그대로 남지만, 장소 목록에서는 빠지고 기본 이모지(${DEFAULT_LOCATION_EMOJI})로 표시됩니다.`
            : "장소 목록에서 삭제됩니다."
        }
        confirmLabel="삭제"
        danger
        onCancel={() => setLocationDeleteTarget(null)}
        onConfirm={deleteLocation}
        loading={!!locationDeleteTarget && locationBusyId === locationDeleteTarget.id}
      />
    </div>
  );
}
