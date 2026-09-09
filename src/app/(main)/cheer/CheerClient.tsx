"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { classLabel } from "@/lib/scoring";
import type { CheerAward, ClassRow, Profile } from "@/lib/database.types";
import { ConfirmDialog } from "@/components/ConfirmDialog";

function signed(points: number): string {
  return points >= 0 ? `+${points}` : `${points}`;
}

const GRADE_STYLE: Record<number, { border: string; header: string; badge: string }> = {
  1: { border: "border-blue-400", header: "bg-blue-50", badge: "bg-blue-600 text-white" },
  2: { border: "border-purple-400", header: "bg-purple-50", badge: "bg-purple-600 text-white" },
  3: { border: "border-green-400", header: "bg-green-50", badge: "bg-green-600 text-white" },
};

export function CheerClient({
  initialClasses,
  initialAwards,
}: {
  initialClasses: ClassRow[];
  initialAwards: CheerAward[];
}) {
  const [awards, setAwards] = useState<CheerAward[]>(initialAwards);
  const [giveTarget, setGiveTarget] = useState<ClassRow | null>(null);
  const [givePoints, setGivePoints] = useState(10);
  const [giving, setGiving] = useState(false);
  const [historyFor, setHistoryFor] = useState<ClassRow | null>(null);
  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("cheer-awards-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cheer_awards" },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as CheerAward;
            setAwards((prev) => prev.filter((a) => a.id !== old.id));
            return;
          }
          const next = payload.new as CheerAward;
          setAwards((prev) => {
            const idx = prev.findIndex((a) => a.id === next.id);
            if (idx === -1) return [...prev, next];
            const copy = [...prev];
            copy[idx] = next;
            return copy;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const totalsByClass = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of awards) map.set(a.class_id, (map.get(a.class_id) ?? 0) + a.points);
    return map;
  }, [awards]);

  const classesByGrade = useMemo(() => {
    const map = new Map<number, ClassRow[]>();
    for (const c of initialClasses) {
      if (!map.has(c.grade)) map.set(c.grade, []);
      map.get(c.grade)!.push(c);
    }
    return map;
  }, [initialClasses]);

  async function confirmGive() {
    if (!giveTarget) return;
    setGiving(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("cheer_awards")
      .insert({
        class_id: giveTarget.id,
        points: givePoints,
        awarded_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    setGiving(false);
    if (error) {
      alert("지급 실패: " + error.message);
      return;
    }
    // 실시간 구독이 돌아올 때까지 기다리지 않고, 지급한 사람 화면에는 바로 반영한다.
    const newAward = data as CheerAward;
    setAwards((prev) => (prev.some((a) => a.id === newAward.id) ? prev : [...prev, newAward]));
    setGiveTarget(null);
    setGivePoints(10);
  }

  async function openHistory(c: ClassRow) {
    setHistoryFor(c);
    const ids = [
      ...new Set(
        awards
          .filter((a) => a.class_id === c.id)
          .map((a) => a.awarded_by)
          .filter((x): x is string => !!x),
      ),
    ];
    if (ids.length === 0) return;
    const supabase = createClient();
    const { data } = await supabase.from("profiles").select("*").in("id", ids);
    const map: Record<string, Profile> = {};
    for (const p of (data ?? []) as Profile[]) map[p.id] = p;
    setProfilesById((prev) => ({ ...prev, ...map }));
  }

  const historyAwards = historyFor
    ? awards
        .filter((a) => a.class_id === historyFor.id)
        .sort((a, b) => new Date(b.awarded_at).getTime() - new Date(a.awarded_at).getTime())
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">🎉 응원 점수</h1>
        <p className="mt-1 text-sm text-slate-500">
          반이 열심히 응원·질서를 지킬 때마다 점수를 눌러서 바로 지급하세요. 반대로 응원·질서를
          지키지 않으면 마이너스 점수로 감점할 수도 있어요. 지급한 점수는 누적되고, 종합
          순위와는 별도로 응원상으로 따로 집계·시상됩니다.
        </p>
      </div>

      <div className="space-y-6">
        {[...classesByGrade.keys()].sort().map((grade) => {
          const style = GRADE_STYLE[grade];
          return (
            <div key={grade} className={`overflow-hidden rounded-xl border-l-4 ${style.border} border border-slate-200 bg-white`}>
              <div className={`flex items-center gap-2 px-5 py-2 ${style.header}`}>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${style.badge}`}>
                  {grade}학년
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {classesByGrade.get(grade)!.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                    <span className="w-20 shrink-0 font-medium text-slate-700">
                      {classLabel(c)}
                    </span>
                    <span
                      className={`text-lg font-extrabold ${
                        (totalsByClass.get(c.id) ?? 0) < 0 ? "text-red-600" : "text-amber-600"
                      }`}
                    >
                      {totalsByClass.get(c.id) ?? 0}점
                    </span>
                    <div className="ml-auto flex shrink-0 gap-2">
                      <button
                        onClick={() => openHistory(c)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50"
                      >
                        이력
                      </button>
                      <button
                        onClick={() => {
                          setGivePoints(10);
                          setGiveTarget(c);
                        }}
                        className="rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:shadow-md"
                      >
                        🎉 점수 주기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!giveTarget}
        title={`${giveTarget ? classLabel(giveTarget) : ""}에 응원 점수 주기`}
        confirmLabel="지급"
        loading={giving}
        onCancel={() => setGiveTarget(null)}
        onConfirm={confirmGive}
        description={
          <div className="space-y-2">
            <p className="text-xs text-slate-500">
              -100~100점 사이로 입력하세요. 마이너스 값을 넣으면 감점돼요.
            </p>
            <input
              type="number"
              min={-100}
              max={100}
              autoFocus
              value={givePoints}
              onChange={(e) =>
                setGivePoints(Math.max(-100, Math.min(100, Number(e.target.value) || 0)))
              }
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-lg font-bold"
            />
          </div>
        }
      />

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="max-h-[70vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {classLabel(historyFor)} 응원 점수 이력
              </h2>
              <button
                onClick={() => setHistoryFor(null)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                닫기
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {historyAwards.length === 0 && (
                <p className="text-sm text-slate-400">지급 기록이 없습니다.</p>
              )}
              {historyAwards.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-xs"
                >
                  <div>
                    <p className={`font-bold ${a.points < 0 ? "text-red-600" : "text-amber-600"}`}>
                      {signed(a.points)}점
                    </p>
                    <p className="mt-0.5 text-slate-500">
                      {new Date(a.awarded_at).toLocaleString("ko-KR")} ·{" "}
                      {a.awarded_by ? (profilesById[a.awarded_by]?.name ?? "알 수 없음") : "알 수 없음"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
