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
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-bold text-slate-900">🛠️ 관리자 대시보드</h1>
        <p className="mt-1 text-sm text-slate-500">
          관리자만 할 수 있는 3가지: 종목 이름 수정, 교사 계정 등록, 잘못된 점수 초기화.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/events"
          className="rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-6 text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg"
        >
          <p className="text-3xl">🏷️</p>
          <p className="mt-2 text-lg font-extrabold">종목 이름 수정</p>
          <p className="mt-1 text-sm text-blue-50">반대항전·미니게임 종목명을 바꿔요</p>
        </Link>
        <Link
          href="/admin/teachers"
          className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg"
        >
          <p className="text-3xl">👩‍🏫</p>
          <p className="mt-2 text-lg font-extrabold">교사 계정</p>
          <p className="mt-1 text-sm text-emerald-50">계정 생성·삭제·권한 변경</p>
        </Link>
        <Link
          href="/admin/scores"
          className="rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 p-6 text-white shadow-md transition hover:scale-[1.02] hover:shadow-lg"
        >
          <p className="text-3xl">🔄</p>
          <p className="mt-2 text-lg font-extrabold">점수 초기화</p>
          <p className="mt-1 text-sm text-orange-50">잘못 제출된 점수를 되돌려요</p>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="mt-1 text-sm font-bold text-slate-800">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
