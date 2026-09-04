"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type { EventCategory, EventRow, ScoringType } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CATEGORY_ORDER: EventCategory[] = ["field", "gym", "minigame"];

export function EventsClient({ initialEvents }: { initialEvents: EventRow[] }) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState<Set<string>>(new Set());
  const [dragSource, setDragSource] = useState<{ cat: EventCategory; index: number } | null>(
    null,
  );

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
    category: EventCategory;
    scoring_type: ScoringType;
  }>({ name: "", category: "field", scoring_type: "rank" });
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<EventCategory, EventRow[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const ev of events) map.get(ev.category)?.push(ev);
    for (const list of map.values()) list.sort((a, b) => a.order_index - b.order_index);
    return map;
  }, [events]);

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
        order_index: ev.order_index,
        is_active: ev.is_active,
        is_locked: ev.is_locked,
        point_table: ev.point_table,
        pass_points: ev.pass_points,
        max_points: ev.max_points,
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
    if (!newEvent.name.trim()) return;
    setCreating(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("events")
      .insert({
        name: newEvent.name.trim(),
        category: newEvent.category,
        scoring_type: newEvent.scoring_type,
        order_index: (grouped.get(newEvent.category)?.length ?? 0) + 1,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      alert("추가 실패: " + error.message);
      return;
    }
    setEvents((prev) => [...prev, data as EventRow]);
    setNewEvent({ name: "", category: "field", scoring_type: "rank" });
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

  function handleDragStart(cat: EventCategory, index: number) {
    setDragSource({ cat, index });
  }

  async function handleDrop(cat: EventCategory, index: number) {
    const source = dragSource;
    setDragSource(null);
    if (!source || source.cat !== cat || source.index === index) return;

    const list = [...(grouped.get(cat) ?? [])];
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
          종목 이름을 수정하세요. 왼쪽 ⠿ 을 드래그하면 순서를 바꿀 수 있고, 배점표 등 세부 설정은
          &ldquo;고급 설정&rdquo;에서 바꿀 수 있어요.
        </p>
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
            <label className="block text-xs text-slate-500">분류</label>
            <select
              value={newEvent.category}
              onChange={(e) =>
                setNewEvent((s) => ({ ...s, category: e.target.value as EventCategory }))
              }
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500">채점 방식</label>
            <select
              value={newEvent.scoring_type}
              onChange={(e) =>
                setNewEvent((s) => ({ ...s, scoring_type: e.target.value as ScoringType }))
              }
              className="mt-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              <option value="rank">순위 배점</option>
              <option value="pass_fail">통과/실패</option>
              <option value="direct">직접 입력</option>
            </select>
          </div>
          <button
            onClick={createEvent}
            disabled={creating}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            추가
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          💡 운동장/체육관 분류에서 채점 방식을 &ldquo;직접 입력&rdquo;으로 추가하면, 입력
          화면에서 그 장소만의 노란 응원질서(추가점수) 버튼으로 자동 표시돼요.
        </p>
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) ?? [];
        return (
          <div key={cat}>
            <h2 className="mb-2 text-sm font-bold text-slate-700">{CATEGORY_LABEL[cat]}</h2>
            <div className="space-y-3">
              {list.map((ev, index) => {
                const isOpen = advancedOpen.has(ev.id);
                const isDragging = dragSource?.cat === cat && dragSource.index === index;
                return (
                  <div
                    key={ev.id}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(cat, index)}
                    className={`rounded-xl border bg-white p-4 transition ${
                      isDragging ? "border-blue-400 opacity-50" : "border-slate-200"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        draggable
                        onDragStart={() => handleDragStart(cat, index)}
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
    </div>
  );
}
