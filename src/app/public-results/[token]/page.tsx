import { getPublicResultsData } from "@/lib/publicResults";
import { PublicResultsClient } from "./PublicResultsClient";

export default async function PublicResultsPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getPublicResultsData(token);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <p className="text-4xl">🔒</p>
          <h1 className="mt-3 text-lg font-bold text-slate-900">링크가 올바르지 않아요</h1>
          <p className="mt-1 text-sm text-slate-500">
            주소가 잘못됐거나 더 이상 쓸 수 없는 링크예요. 담임선생님이나 관리자에게 새 링크를
            요청해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PublicResultsClient
      token={token}
      orgName={data.orgName}
      logoUrl={data.logoUrl}
      initialClasses={data.classes}
      initialEvents={data.events}
      initialScores={data.scores}
      initialCheerAwards={data.cheerAwards}
      initialRankingsVisible={data.rankingsVisible}
      initialCheerResultsVisible={data.cheerResultsVisible}
    />
  );
}
