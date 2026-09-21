"use client";

// 입력 탭·응원 점수 탭에서 공통으로 쓰는 "학년 선택" 단계 — 두 화면의 첫
// 단계가 똑같이 생기도록 여기 한 곳에서 관리한다.

// 학년별 체육복 색상
export const GRADE_UNIFORM: Record<number, string> = {
  1: "fill-blue-600",
  2: "fill-purple-600",
  3: "fill-green-600",
};

export function ShirtGraphic({ fillClass, label }: { fillClass: string; label: string }) {
  return (
    <svg viewBox="0 0 100 100" className="mx-auto h-28 w-28 drop-shadow-md" aria-hidden>
      {/* 체육복 몸통 + 소매 */}
      <path
        d="M30,15 C38,24 62,24 70,15 L92,28 L78,40 L78,88 L22,88 L22,40 L8,28 Z"
        className={fillClass}
      />
      {/* 깃 (카라) 라인 */}
      <path
        d="M33,17 C40,24 60,24 67,17"
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.9"
      />
      {/* 소매 밑단 */}
      <line x1="92" y1="28" x2="78" y2="40" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      <line x1="8" y1="28" x2="22" y2="40" stroke="white" strokeOpacity="0.5" strokeWidth="1.5" />
      {/* 옆선 */}
      <line x1="78" y1="40" x2="78" y2="88" stroke="black" strokeOpacity="0.15" strokeWidth="1.5" />
      <line x1="22" y1="40" x2="22" y2="88" stroke="black" strokeOpacity="0.15" strokeWidth="1.5" />
      {/* 등번호 */}
      <text
        x="50"
        y="70"
        textAnchor="middle"
        fontSize="34"
        fontWeight="800"
        fill="white"
        opacity="0.95"
      >
        {label}
      </text>
    </svg>
  );
}

export function BackButton({ onClick, label = "← 뒤로" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
    >
      {label}
    </button>
  );
}

export function GradeGrid({
  grades,
  onPick,
}: {
  grades: (1 | 2 | 3)[];
  onPick: (grade: 1 | 2 | 3) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {grades.map((grade) => (
        <button
          key={grade}
          onClick={() => onPick(grade)}
          className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <ShirtGraphic fillClass={GRADE_UNIFORM[grade]} label={String(grade)} />
          <div className="mt-3 text-xl font-bold text-slate-800">{grade}학년</div>
        </button>
      ))}
    </div>
  );
}
