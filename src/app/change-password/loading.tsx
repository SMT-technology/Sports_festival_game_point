export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gradient-to-br from-blue-600 via-indigo-600 to-orange-500">
      <span className="animate-spin text-5xl">🔄</span>
      <p className="text-sm font-medium text-white">불러오는 중...</p>
    </div>
  );
}
