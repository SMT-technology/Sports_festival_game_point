import type { ClassRow, EventCategory, EventRow, ScoreAuditLog } from "@/lib/database.types";

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
  input: {
    rank?: number | null;
    pass?: boolean | null;
    direct?: number | null;
    tier?: number | null;
  },
): number {
  if (event.scoring_type === "rank") return previewRankPoints(event, input.rank ?? null);
  if (event.scoring_type === "pass_fail") return input.pass ? event.pass_points : 0;
  if (event.scoring_type === "direct") return input.direct ?? 0;
  if (event.scoring_type === "tier") {
    if (input.tier == null) return 0;
    return event.tier_options[input.tier]?.points ?? 0;
  }
  return 0;
}

export const AUDIT_ACTION_LABEL: Record<ScoreAuditLog["action"], string> = {
  create: "생성",
  update: "수정",
  final_submit: "최종 제출",
  unlock: "잠금 해제",
  admin_edit: "관리자 수정",
  delete: "취소(삭제)",
};

/** 이력 기록(old_data/new_data)은 그 시점 scores 행 전체를 그대로 저장해둔 것이라,
 * 종목의 채점 방식에 맞춰 사람이 읽을 수 있는 문구로 바꿔서 보여준다. */
export function describeScoreSnapshot(
  event: EventRow | null,
  data: Record<string, unknown> | null,
): string {
  if (!event || !data) return "-";
  const computed = typeof data.computed_points === "number" ? data.computed_points : null;
  let raw = "미입력";
  if (event.scoring_type === "rank") {
    if (typeof data.rank_value === "number") raw = `${data.rank_value}위`;
  } else if (event.scoring_type === "pass_fail") {
    if (data.pass_value === true) raw = "통과";
    else if (data.pass_value === false) raw = "실패";
  } else if (event.scoring_type === "direct") {
    if (typeof data.direct_value === "number") raw = `직접입력 ${data.direct_value}`;
  } else if (event.scoring_type === "tier") {
    if (typeof data.tier_index === "number") {
      raw = event.tier_options[data.tier_index]?.label || `단계 ${data.tier_index + 1}`;
    }
  }
  return computed != null ? `${raw} (${computed}점)` : raw;
}
