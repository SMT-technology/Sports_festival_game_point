"use client";

import { useState } from "react";
import { classLabel } from "@/lib/scoring";
import type { ClassRow } from "@/lib/database.types";
import type { ClassComputed } from "./types";

const PODIUM_STYLE = [
  {
    medal: "🥇",
    label: "1위",
    height: "min-h-[280px]",
    bg: "bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500",
    ring: "ring-amber-200",
    scale: "sm:scale-110",
  },
  {
    medal: "🥈",
    label: "2위",
    height: "min-h-[210px]",
    bg: "bg-gradient-to-b from-slate-200 via-slate-300 to-slate-400",
    ring: "ring-slate-200",
    scale: "",
  },
  {
    medal: "🥉",
    label: "3위",
    height: "min-h-[170px]",
    bg: "bg-gradient-to-b from-orange-300 via-orange-400 to-orange-500",
    ring: "ring-orange-200",
    scale: "",
  },
];

const GRADE_STYLE: Record<number, { gradient: string; ring: string }> = {
  1: { gradient: "from-blue-500 to-blue-700", ring: "ring-blue-200" },
  2: { gradient: "from-purple-500 to-purple-700", ring: "ring-purple-200" },
  3: { gradient: "from-green-500 to-green-700", ring: "ring-green-200" },
};

function rankFor(list: ClassRow[], classComputed: ClassComputed, classId: string) {
  const totals = list.map((c) => classComputed.get(c.id)?.total ?? 0);
  const idx = list.findIndex((c) => c.id === classId);
  const myTotal = totals[idx];
  return totals.filter((t) => t > myTotal).length + 1;
}

function PodiumSlot({
  c,
  total,
  style,
}: {
  c: ClassRow | undefined;
  total: number;
  style: (typeof PODIUM_STYLE)[number];
}) {
  if (!c) return <div className="w-32 sm:w-44" />;
  return (
    <div
      className={`flex w-32 flex-col items-center justify-end rounded-3xl ${style.bg} ${style.height} ${style.scale} p-4 text-center text-white shadow-2xl ring-4 ${style.ring} sm:w-44`}
    >
      <span className="text-6xl drop-shadow-lg sm:text-7xl">{style.medal}</span>
      <p className="mt-2 text-base font-bold drop-shadow sm:text-lg">{classLabel(c)}</p>
      <p className="text-4xl font-black drop-shadow sm:text-5xl">{total}</p>
      <p className="text-sm font-bold opacity-90">{style.label}</p>
    </div>
  );
}

function GradePicker({ grades, onPick }: { grades: number[]; onPick: (g: number) => void }) {
  return (
    <div className="space-y-6 text-center">
      <p className="text-6xl">🏆</p>
      <h1 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">실시간 현재 순위</h1>
      <p className="text-sm text-slate-500">확인할 학년을 선택해주세요.</p>
      <div className="mx-auto grid max-w-md grid-cols-1 gap-4 sm:grid-cols-3">
        {grades.map((g) => {
          const style = GRADE_STYLE[g];
          return (
            <button
              key={g}
              onClick={() => onPick(g)}
              className={`rounded-2xl bg-gradient-to-br ${style.gradient} p-8 text-center text-white shadow-lg ring-4 ${style.ring} transition hover:-translate-y-1 hover:shadow-2xl`}
            >
              <div className="text-5xl font-black drop-shadow">{g}</div>
              <div className="mt-1 text-lg font-bold drop-shadow">학년</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HiddenNotice() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
      <p className="text-7xl">🤫</p>
      <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
        최종 순위는 잠시 후 운동장에서 발표됩니다!
      </h1>
      <p className="text-sm text-slate-500">조금만 기다려주세요 🎉</p>
    </div>
  );
}

export function PodiumBoard({
  classesByGrade,
  classComputed,
  rankingsVisible,
}: {
  classesByGrade: Map<number, ClassRow[]>;
  classComputed: ClassComputed;
  rankingsVisible: boolean;
}) {
  const grades = [...classesByGrade.keys()].sort();
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  if (!rankingsVisible) {
    return <HiddenNotice />;
  }

  if (selectedGrade === null || !classesByGrade.has(selectedGrade)) {
    return <GradePicker grades={grades} onPick={setSelectedGrade} />;
  }

  const list = classesByGrade.get(selectedGrade)!;
  const [first, second, third] = list;
  const rest = list.slice(3);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setSelectedGrade(null)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
        >
          ← 학년 다시 선택
        </button>
      </div>

      <div className="text-center">
        <p className="text-5xl">🏆</p>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-4xl">
          실시간 현재 순위
        </h1>
        <p className="mt-1 text-xl font-bold text-slate-600">{selectedGrade}학년</p>
      </div>

      <div className="flex items-end justify-center gap-3 sm:gap-6">
        <PodiumSlot
          c={second}
          total={classComputed.get(second?.id ?? "")?.total ?? 0}
          style={PODIUM_STYLE[1]}
        />
        <PodiumSlot
          c={first}
          total={classComputed.get(first?.id ?? "")?.total ?? 0}
          style={PODIUM_STYLE[0]}
        />
        <PodiumSlot
          c={third}
          total={classComputed.get(third?.id ?? "")?.total ?? 0}
          style={PODIUM_STYLE[2]}
        />
      </div>

      {rest.length > 0 && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {rest.map((c) => {
            const rank = rankFor(list, classComputed, c.id);
            const total = classComputed.get(c.id)?.total ?? 0;
            return (
              <span
                key={c.id}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 shadow-sm"
              >
                {rank}위 · {classLabel(c)} · <b className="text-slate-800">{total}점</b>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
