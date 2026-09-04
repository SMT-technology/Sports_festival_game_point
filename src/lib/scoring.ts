import type { ClassRow, EventCategory, EventRow } from "@/lib/database.types";

export const CATEGORY_LABEL: Record<EventCategory, string> = {
  field: "운동장",
  gym: "체육관",
  minigame: "단합 미니게임",
};

export function classLabel(c: Pick<ClassRow, "grade" | "class_no">) {
  return `${c.grade}학년 ${c.class_no}반`;
}

export function sortClasses(rows: ClassRow[]) {
  return [...rows].sort((a, b) => a.grade - b.grade || a.class_no - b.class_no);
}

export function sortEvents(rows: EventRow[]) {
  return [...rows].sort((a, b) => a.order_index - b.order_index);
}

/** 순위(rank) 입력값에 대해 배점표를 적용했을 때 예상 점수를 미리 보여주기 위한 헬퍼 (표시 전용, 실제 계산은 DB 트리거가 담당) */
export function previewRankPoints(event: EventRow, rank: number | null): number {
  if (rank == null) return 0;
  return event.point_table[String(rank)] ?? 0;
}

export function previewPoints(
  event: EventRow,
  input: { rank?: number | null; pass?: boolean | null; direct?: number | null },
): number {
  if (event.scoring_type === "rank") return previewRankPoints(event, input.rank ?? null);
  if (event.scoring_type === "pass_fail") return input.pass ? event.pass_points : 0;
  if (event.scoring_type === "direct") return input.direct ?? 0;
  return 0;
}
