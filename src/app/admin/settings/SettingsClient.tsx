"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { driveShareLinkToDirectUrl } from "@/lib/googleDrive";

function DriveLinkHelper({
  onConvert,
}: {
  onConvert: (directUrl: string) => void;
}) {
  const [driveInput, setDriveInput] = useState("");
  const [driveError, setDriveError] = useState<string | null>(null);

  function convert() {
    const direct = driveShareLinkToDirectUrl(driveInput);
    if (!direct) {
      setDriveError("구글 드라이브 링크 형식을 알아보지 못했어요. 공유 링크를 다시 확인해주세요.");
      return;
    }
    setDriveError(null);
    onConvert(direct);
    setDriveInput("");
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">📁 구글 드라이브 공유 링크로 채우기</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        ① 드라이브에서 이미지 파일을 우클릭 → 공유 → 일반 액세스를{" "}
        <b className="text-slate-600">&ldquo;링크가 있는 모든 사용자&rdquo;</b>로 바꾸기 (뷰어
        권한이면 충분해요) → 공유 링크 복사
        <br />
        ② 그 링크를 아래에 붙여넣고 변환 버튼을 누르면 위 칸에 자동으로 채워져요.
        <br />
        <span className="text-amber-600">
          ※ 공유 링크를 위 칸에 그대로 붙여넣으면 이미지가 아니라 구글 드라이브 화면이 통째로
          떠서 안 보여요 — 꼭 이 변환 과정을 거쳐야 해요.
        </span>
      </p>
      <div className="mt-2 flex gap-2">
        <input
          value={driveInput}
          onChange={(e) => {
            setDriveInput(e.target.value);
            setDriveError(null);
          }}
          placeholder="https://drive.google.com/file/d/xxxx/view?usp=sharing"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={convert}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          변환해서 채우기
        </button>
      </div>
      {driveError && <p className="mt-1 text-xs text-red-600">{driveError}</p>}
    </div>
  );
}

export function SettingsClient({
  initialOrgName,
  initialLogoUrl,
  initialTimetableUrl,
}: {
  initialOrgName: string;
  initialLogoUrl: string;
  initialTimetableUrl: string;
}) {
  const [orgName, setOrgName] = useState(initialOrgName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [timetableUrl, setTimetableUrl] = useState(initialTimetableUrl);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const [timetableImgError, setTimetableImgError] = useState(false);

  async function save() {
    if (!orgName.trim() || !logoUrl.trim() || !timetableUrl.trim()) {
      setMessage("대회 이름, 로고 이미지 URL, 시간표 이미지 URL을 모두 입력하세요.");
      return;
    }
    setSaving(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("app_settings")
      .update({
        org_name: orgName.trim(),
        logo_url: logoUrl.trim(),
        timetable_url: timetableUrl.trim(),
      })
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
          대회 이름, 로고 이미지, 시간표 이미지를 바꿀 수 있어요. 로그인 화면, 상단 메뉴,
          브라우저 탭 제목, 시간표 팝업까지 전부 여기 값으로 바뀝니다. 다른 학교에서 이
          시스템을 재사용할 때 이 화면만 바꾸면 돼요.
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
          <DriveLinkHelper
            onConvert={(url) => {
              setLogoUrl(url);
              setImgError(false);
            }}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">로고 미리보기</p>
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

        <div className="border-t border-slate-100 pt-4">
          <label className="block text-sm font-medium text-slate-700">시간표 이미지 URL</label>
          <input
            value={timetableUrl}
            onChange={(e) => {
              setTimetableUrl(e.target.value);
              setTimetableImgError(false);
            }}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="https://... 또는 /sports-festival-game_TT.png"
          />
          <p className="mt-1 text-xs text-slate-400">
            상단 메뉴 🗓️ 시간표 버튼을 눌렀을 때 뜨는 이미지예요. GitHub 등에 이미지를 올리고
            그 주소를 붙여넣으세요.
          </p>
          <DriveLinkHelper
            onConvert={(url) => {
              setTimetableUrl(url);
              setTimetableImgError(false);
            }}
          />
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">시간표 미리보기</p>
          <div className="flex max-h-48 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-2">
            {timetableImgError ? (
              <span className="text-xs text-red-500">불러오기 실패</span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={timetableUrl}
                alt="시간표 미리보기"
                className="max-h-44 w-auto object-contain"
                onError={() => setTimetableImgError(true)}
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
