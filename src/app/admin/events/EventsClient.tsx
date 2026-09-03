"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_LABEL } from "@/lib/scoring";
import type { EventCategory, EventRow, ScoringType } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

const CATEGORY_ORDER: EventCategory[] = ["relay", "minigame", "cheer"];

export function EventsClient({ initialEvents }: { initialEvents: EventRow[] }) {
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EventRow | null>(null);
  const [newEvent, setNewEvent] = useState<{
    name: string;
    category: EventCategory;
    scoring_type: ScoringType;
  }>({ name: "", category: "relay", scoring_type: "rank" });
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
    setBusyId(null);
    if (error) alert("저장 실패: " + error.message);
  }

  async function recompute(ev: EventRow) {
    setBusyId(ev.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("scores")
      .update({ updated_at: new Date().toISOString() })
      .eq("event_id", ev.id);
    setBusyId(null);
    if (error) alert("재계산 실패: " + error.message);
    else alert("배점표 변경사항이 기존 제출 점수에 재적용되었습니다.");
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
        order_index: events.length + 1,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      alert("추가 실패: " + error.message);
      return;
    }
    setEvents((prev) => [...prev, data as EventRow]);
    setNewEvent({ name: "", category: "relay", scoring_type: "rank" });
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">종목·배점 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          종목별 배점표를 수정할 수 있습니다. 이미 제출된 점수에 반영하려면 &ldquo;재계산
          적용&rdquo;을 눌러주세요.
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
      </div>

      {CATEGORY_ORDER.map((cat) => {
        const list = grouped.get(cat) ?? [];
        return (
          <div key={cat}>
            <h2 className="mb-2 text-sm font-bold text-slate-700">{CATEGORY_LABEL[cat]}</h2>
            <div className="space-y-3">
              {list.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      value={ev.name}
                      onChange={(e) => patchLocal(ev.id, { name: e.target.value })}
                      className="w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      순서
                      <input
                        type="number"
                        value={ev.order_index}
                        onChange={(e) =>
                          patchLocal(ev.id, { order_index: Number(e.target.value) })
                        }
                        className="w-16 rounded-lg border border-slate-300 px-2 py-1"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={ev.is_active}
                        onChange={(e) => patchLocal(ev.id, { is_active: e.target.checked })}
                      />
                      활성화
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-slate-500">
                      <input
                        type="checkbox"
                        checked={ev.is_locked}
                        onChange={(e) => patchLocal(ev.id, { is_locked: e.target.checked })}
                      />
                      입력 잠금
                    </label>

                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={() => recompute(ev)}
                        disabled={busyId === ev.id}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        재계산 적용
                      </button>
                      <button
                        onClick={() => saveEvent(ev)}
                        disabled={busyId === ev.id}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setDeleteTarget(ev)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {ev.scoring_type === "rank" && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">
                          순위별 점수 (표에 없는 순위는 0점)
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
                </div>
              ))}
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
