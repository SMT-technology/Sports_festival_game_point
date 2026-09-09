import type { ClassRow, EventLocation, EventRow, ScoreAuditLog } from "@/lib/database.types";

export function classLabel(c: Pick<ClassRow, "grade" | "class_no">) {
  return `${c.grade}학년 ${c.class_no}반`;
}

export function sortClasses(rows: ClassRow[]) {
  return [...rows].sort((a, b) => a.grade - b.grade || a.class_no - b.class_no);
}

export function sortEvents(rows: EventRow[]) {
  return [...rows].sort((a, b) => a.order_index - b.order_index);
}

export function sortLocations(rows: EventLocation[]) {
  return [...rows].sort((a, b) => a.order_index - b.order_index);
}

/** 장소 이름으로 이모지를 찾는다. 목록에서 지워졌거나 아직 목록에 없는(오래된) 값이면 기본 이모지로 대체. */
export function locationEmoji(locations: EventLocation[], name: string): string {
  return locations.find((l) => l.name === name)?.emoji ?? "📍";
}

// 장소가 몇 개든 상관없이 돌려쓰는 색상 팔레트 (관리자 화면에서 장소별로 시각적으로 구분하기 위함)
const LOCATION_STYLES = [
  { border: "border-red-300", header: "bg-red-50 text-red-700", gradient: "from-red-500 to-orange-500" },
  { border: "border-sky-300", header: "bg-sky-50 text-sky-700", gradient: "from-sky-500 to-blue-600" },
  {
    border: "border-fuchsia-300",
    header: "bg-fuchsia-50 text-fuchsia-700",
    gradient: "from-fuchsia-500 to-purple-600",
  },
  {
    border: "border-emerald-300",
    header: "bg-emerald-50 text-emerald-700",
    gradient: "from-emerald-500 to-teal-600",
  },
  {
    border: "border-amber-300",
    header: "bg-amber-50 text-amber-700",
    gradient: "from-amber-500 to-orange-600",
  },
  {
    border: "border-indigo-300",
    header: "bg-indigo-50 text-indigo-700",
    gradient: "from-indigo-500 to-blue-700",
  },
];

export function locationStyle(index: number) {
  return LOCATION_STYLES[index % LOCATION_STYLES.length];
}

export interface LocationGroup {
  name: string;
  emoji: string;
  events: EventRow[];
}

/** 종목들을 장소(category) 기준으로 묶어서, 장소 목록의 순서대로 정렬해 돌려준다.
 * 장소 목록에서 지워졌지만 아직 그 이름을 쓰는 종목이 남아있으면 맨 뒤에 붙여준다. */
export function groupEventsByLocation(
  events: EventRow[],
  locations: EventLocation[],
): LocationGroup[] {
  const byName = new Map<string, EventRow[]>();
  for (const ev of events) {
    if (!byName.has(ev.category)) byName.set(ev.category, []);
    byName.get(ev.category)!.push(ev);
  }

  const groups: LocationGroup[] = [];
  const seen = new Set<string>();
  for (const loc of sortLocations(locations)) {
    const evs = byName.get(loc.name);
    if (!evs || evs.length === 0) continue;
    groups.push({ name: loc.name, emoji: loc.emoji, events: sortEvents(evs) });
    seen.add(loc.name);
  }
  for (const [name, evs] of byName) {
    if (seen.has(name)) continue;
    groups.push({ name, emoji: "📍", events: sortEvents(evs) });
  }
  return groups;
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
