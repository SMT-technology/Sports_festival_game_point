export default function Loading() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
      <span className="animate-spin text-5xl">🔄</span>
      <p className="text-sm font-medium text-slate-500">불러오는 중...</p>
    </div>
  );
}
