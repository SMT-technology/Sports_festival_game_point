"use client";

import { useState } from "react";
import { driveShareLinkToDirectUrl } from "@/lib/googleDrive";

export function DriveLinkHelper({
  onConvert,
  sizeW,
}: {
  onConvert: (directUrl: string) => void;
  sizeW?: number;
}) {
  const [driveInput, setDriveInput] = useState("");
  const [driveError, setDriveError] = useState<string | null>(null);

  function convert() {
    const direct = driveShareLinkToDirectUrl(driveInput, sizeW);
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
