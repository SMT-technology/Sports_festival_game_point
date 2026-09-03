import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [{ count: classCount }, { count: eventCount }, { count: teacherCount }, { data: scores }] =
    await Promise.all([
      supabase.from("classes").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }).eq("is_active", true),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("scores").select("status"),
    ]);

  const finalCount = (scores ?? []).filter((s) => s.status === "final").length;
  const draftCount = (scores ?? []).filter((s) => s.status === "draft").length;
  const totalSlots = (classCount ?? 0) * (eventCount ?? 0);

  const cards = [
    { label: "등록된 반", value: `${classCount ?? 0}개` },
    { label: "진행 종목", value: `${eventCount ?? 0}개` },
    { label: "교사 계정", value: `${teacherCount ?? 0}명` },
    {
      label: "점수 제출 현황",
      value: `최종 ${finalCount} · 임시 ${draftCount} / 전체 ${totalSlots}`,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold text-slate-900">관리자 대시보드</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/events"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <p className="font-semibold text-slate-800">종목·배점 관리</p>
          <p className="mt-1 text-xs text-slate-500">종목 추가, 배점표 수정, 잠금/활성화</p>
        </Link>
        <Link
          href="/admin/teachers"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <p className="font-semibold text-slate-800">교사 계정 관리</p>
          <p className="mt-1 text-xs text-slate-500">계정 생성/삭제, 권한 변경, 종목 배정</p>
        </Link>
        <Link
          href="/admin/scores"
          className="rounded-xl border border-slate-200 bg-white p-5 hover:border-blue-300"
        >
          <p className="font-semibold text-slate-800">점수 직접 관리</p>
          <p className="mt-1 text-xs text-slate-500">모든 점수 조회/수정/잠금해제, 변경 이력</p>
        </Link>
      </div>
    </div>
  );
}
