export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50">
      <span className="animate-spin text-4xl">🔄</span>
      <p className="text-sm font-medium text-slate-500">불러오는 중...</p>
    </div>
  );
}
