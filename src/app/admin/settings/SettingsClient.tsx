"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SettingsClient({
  initialOrgName,
  initialLogoUrl,
}: {
  initialOrgName: string;
  initialLogoUrl: string;
}) {
  const [orgName, setOrgName] = useState(initialOrgName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  async function save() {
    if (!orgName.trim() || !logoUrl.trim()) {
      setMessage("대회 이름과 로고 이미지 URL을 모두 입력하세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({ org_name: orgName.trim(), logo_url: logoUrl.trim() })
      .eq("id", 1);
    setSaving(false);
    if (error) {
      setMessage("저장 실패: " + error.message);
      return;
    }
    setMessage("저장했습니다. 새로고침하면 모든 화면에 반영됩니다.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-slate-900">⚙️ 사이트 설정</h1>
        <p className="mt-1 text-sm text-slate-500">
          대회 이름과 로고 이미지를 바꿀 수 있어요. 로그인 화면, 상단 메뉴, 브라우저 탭
          제목까지 전부 여기 값으로 바뀝니다. 다른 학교에서 이 시스템을 재사용할 때 이 화면만
          바꾸면 돼요.
        </p>
      </div>

      <div className="max-w-lg space-y-4 rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <label className="block text-sm font-medium text-slate-700">대회 이름</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="예: 신도체육한마당"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">로고 이미지 URL</label>
          <input
            value={logoUrl}
            onChange={(e) => {
              setLogoUrl(e.target.value);
              setImgError(false);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="https://... 또는 /logo.jpg"
          />
          <p className="mt-1 text-xs text-slate-400">
            어딘가에 이미지를 먼저 업로드하고, 그 이미지 주소(URL)를 붙여넣으세요.
          </p>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">미리보기</p>
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-50">
            {imgError ? (
              <span className="text-xs text-red-500">불러오기 실패</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="로고 미리보기"
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            )}
          </div>
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {message && <p className="text-sm text-slate-600">{message}</p>}
      </div>
    </div>
  );
}
