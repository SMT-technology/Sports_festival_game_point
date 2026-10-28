import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { sortClasses, sortEvents } from "@/lib/scoring";
import type { AppSettings, CheerAward, ClassRow, EventRow, Profile, School, ScoreRow } from "@/lib/database.types";
import { SchoolDangerZone } from "./SchoolDangerZone";

export default async function SchoolOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: school },
    { data: admins },
    { data: classes },
    { data: events },
    { data: scores },
    { data: cheerAwards },
    { data: settings },
    { count: archiveCount },
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", id).single(),
    supabase.from("profiles").select("*").eq("school_id", id).eq("role", "admin"),
    supabase.from("classes").select("*").eq("school_id", id),
    supabase.from("events").select("*").eq("school_id", id),
    supabase.from("scores").select("*").eq("school_id", id),
    supabase.from("cheer_awards").select("*").eq("school_id", id),
    supabase.from("app_settings").select("*").eq("school_id", id).single(),
    supabase.from("school_archives").select("*", { count: "exact", head: true }).eq("school_id", id),
  ]);

  if (!school) {
    return (
      <div className="space-y-4">
        <Link href="/super/schools" className="text-sm text-blue-600 underline">
          ← 학교 목록으로
        </Link>
        <p className="text-sm text-slate-500">학교를 찾을 수 없어요.</p>
      </div>
    );
  }

  const s = school as School;
  const schoolAdmins = (admins ?? []) as Profile[];
  const sortedClasses = sortClasses((classes ?? []) as ClassRow[]);
  const sortedEvents = sortEvents((events ?? []) as EventRow[]);
  const scoreRows = (scores ?? []) as ScoreRow[];
  const awards = (cheerAwards ?? []) as CheerAward[];
  const appSettings = settings as AppSettings | null;

  const gradeCounts = [1, 2, 3].map((grade) => ({
    grade,
    count: sortedClasses.filter((c) => c.grade === grade).length,
  }));

  const totalCheerPoints = awards.reduce((sum, a) => sum + a.points, 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/super/schools" className="text-sm text-blue-600 underline">
          ← 학교 목록으로
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            📊 {s.name} 현황{" "}
            <span className="text-sm font-normal text-slate-400">(읽기 전용)</span>
          </h2>
          <a
            href={`/api/super/schools/${s.id}/export`}
            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
          >
            ⬇️ 결과 CSV 내보내기
          </a>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          /login/{s.slug} · 생성일 {new Date(s.created_at).toLocaleDateString("ko-KR")}
          {archiveCount ? ` · 보관된 지난 기록 ${archiveCount}건` : ""}
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">관리자 계정</h3>
        {schoolAdmins.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">관리자 계정이 없어요.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {schoolAdmins.map((a) => (
              <li key={a.id}>
                {a.name} <span className="text-slate-400">({a.email})</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {gradeCounts.map(({ grade, count }) => (
          <div key={grade} className="rounded-xl border border-slate-200 bg-white p-4 text-center">
            <p className="text-xs text-slate-400">{grade}학년</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">{count}</p>
            <p className="text-xs text-slate-400">개 반</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700">종목별 점수 제출 현황</h3>
        {sortedEvents.length === 0 ? (
          <p className="mt-2 text-sm text-slate-400">등록된 종목이 없어요.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-1.5 pr-3">종목</th>
                  <th className="py-1.5 pr-3">분류</th>
                  <th className="py-1.5 pr-3">대상 학년</th>
                  <th className="py-1.5 pr-3">활성</th>
                  <th className="py-1.5">최종 제출</th>
                </tr>
              </thead>
              <tbody>
                {sortedEvents.map((ev) => {
                  const applicableClasses = sortedClasses.filter((c) =>
                    ev.grades.includes(c.grade),
                  ).length;
                  const finalCount = scoreRows.filter(
                    (sc) => sc.event_id === ev.id && sc.status === "final",
                  ).length;
                  return (
                    <tr key={ev.id} className="border-b border-slate-50">
                      <td className="py-1.5 pr-3 font-medium text-slate-800">{ev.name}</td>
                      <td className="py-1.5 pr-3 text-slate-500">{ev.category}</td>
                      <td className="py-1.5 pr-3 text-slate-500">
                        {ev.grades.map((g) => `${g}학년`).join(", ")}
                      </td>
                      <td className="py-1.5 pr-3">
                        {ev.is_active ? (
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                            활성
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            비활성
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-slate-700">
                        {finalCount}/{applicableClasses}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">응원점수 지급 횟수 / 합계</p>
          <p className="mt-1 text-xl font-bold text-slate-800">
            {awards.length}회 / {totalCheerPoints}점
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-400">공개 설정</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span
              className={`rounded-full px-2 py-0.5 ${
                appSettings?.rankings_visible
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              순위 {appSettings?.rankings_visible ? "공개" : "비공개"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                appSettings?.cheer_results_visible
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              응원점수 {appSettings?.cheer_results_visible ? "공개" : "비공개"}
            </span>
          </div>
        </div>
      </section>

      <SchoolDangerZone schoolId={s.id} schoolName={s.name} />
    </div>
  );
}
