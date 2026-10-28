import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/adminGuard";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { CheerAward, ClassRow, EventRow, School, ScoreRow } from "@/lib/database.types";

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(values: (string | number)[]): string {
  return values.map(csvCell).join(",");
}

// 체육대회가 끝난 뒤 결과를 기록으로 남길 수 있도록, 학교의 반별 총점/순위와
// 종목별 상세 점수를 CSV로 내려준다. 화면(결과 탭)과 같은 계산 방식(최종
// 제출된 점수의 computed_points 합)을 그대로 쓴다.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireSuperAdminApi();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: school }, { data: classesData }, { data: eventsData }, { data: scoresData }, { data: cheerData }] =
    await Promise.all([
      admin.from("schools").select("*").eq("id", id).single(),
      admin.from("classes").select("*").eq("school_id", id),
      admin.from("events").select("*").eq("school_id", id),
      admin.from("scores").select("*").eq("school_id", id),
      admin.from("cheer_awards").select("*").eq("school_id", id),
    ]);

  if (!school) return NextResponse.json({ error: "학교를 찾을 수 없습니다." }, { status: 404 });

  const schoolRow = school as School;
  const classes = sortClasses((classesData ?? []) as ClassRow[]);
  const events = sortEvents((eventsData ?? []) as EventRow[]);
  const scores = (scoresData ?? []) as ScoreRow[];
  const cheerAwards = (cheerData ?? []) as CheerAward[];

  const eventsById = new Map(events.map((e) => [e.id, e]));
  const classById = new Map(classes.map((c) => [c.id, c]));

  const classTotal = new Map<string, number>();
  for (const c of classes) classTotal.set(c.id, 0);
  for (const s of scores) {
    if (s.status !== "final") continue;
    classTotal.set(s.class_id, (classTotal.get(s.class_id) ?? 0) + s.computed_points);
  }

  const cheerTotal = new Map<string, number>();
  for (const a of cheerAwards) {
    cheerTotal.set(a.class_id, (cheerTotal.get(a.class_id) ?? 0) + a.points);
  }

  const rankByClass = new Map<string, number>();
  for (const grade of [1, 2, 3] as const) {
    const gradeClasses = classes
      .filter((c) => c.grade === grade)
      .slice()
      .sort((a, b) => (classTotal.get(b.id) ?? 0) - (classTotal.get(a.id) ?? 0));
    gradeClasses.forEach((c, i) => rankByClass.set(c.id, i + 1));
  }

  const lines: string[] = [];
  lines.push(`${schoolRow.name} 체육대회 결과 (내보낸 시각: ${new Date().toLocaleString("ko-KR")})`);
  lines.push("");
  lines.push("[반별 종합 순위]");
  lines.push(csvRow(["학년", "반", "종목 총점", "학년 내 순위", "응원점수 합계"]));
  for (const c of classes) {
    lines.push(
      csvRow([
        `${c.grade}학년`,
        `${c.class_no}반`,
        classTotal.get(c.id) ?? 0,
        rankByClass.get(c.id) ?? "",
        cheerTotal.get(c.id) ?? 0,
      ]),
    );
  }
  lines.push("");
  lines.push("[종목별 점수 상세]");
  lines.push(csvRow(["학년", "반", "종목", "분류", "상태", "점수"]));
  for (const s of scores) {
    const c = classById.get(s.class_id);
    const ev = eventsById.get(s.event_id);
    if (!c || !ev) continue;
    lines.push(
      csvRow([
        `${c.grade}학년`,
        `${c.class_no}반`,
        ev.name,
        ev.category,
        s.status === "final" ? "최종" : "임시",
        s.computed_points,
      ]),
    );
  }

  // 엑셀(윈도우)에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다.
  const csv = "﻿" + lines.join("\n");
  const filename = `${schoolRow.slug}-results-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
