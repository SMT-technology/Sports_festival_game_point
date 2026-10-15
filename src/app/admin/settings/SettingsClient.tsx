"use client";

import { useEffect, useState } from "react";
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

interface GeocodeResult {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

function LocationSearch({
  onPick,
}: {
  onPick: (result: { name: string; lat: number; lon: number }) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query.trim())}&count=5&language=ko`,
      );
      const json = await res.json();
      setResults(json.results ?? []);
      if (!json.results || json.results.length === 0) {
        setError("검색 결과가 없어요. 다른 이름으로 시도해보세요 (예: 서울, 부산, 대전).");
      }
    } catch {
      setError("검색에 실패했어요. 인터넷 연결을 확인해주세요.");
    }
    setSearching(false);
  }

  return (
    <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-600">🔍 지역 검색</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), search())}
          placeholder="예: 서울, 부산, 대전..."
          className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={search}
          disabled={searching}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {searching ? "검색 중..." : "검색"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {results.length > 0 && (
        <div className="mt-2 space-y-1">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                onPick({ name: r.name, lat: r.latitude, lon: r.longitude });
                setResults([]);
                setQuery("");
              }}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-blue-50"
            >
              {r.name}
              {r.admin1 ? ` · ${r.admin1}` : ""}
              {r.country ? ` (${r.country})` : ""}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PublicResultsLink({
  schoolId,
  initialToken,
}: {
  schoolId: string;
  initialToken: string;
}) {
  const [token, setToken] = useState(initialToken);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const readOrigin = () => setOrigin(window.location.origin);
    readOrigin();
  }, []);

  const url = token ? `${origin}/public-results/${token}` : "";

  async function issue(confirmMessage?: string) {
    if (confirmMessage && !confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    const newToken = crypto.randomUUID().replace(/-/g, "");
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("app_secrets")
      .update({ public_results_token: newToken })
      .eq("school_id", schoolId);
    setBusy(false);
    if (updateError) {
      setError("발급 실패: " + updateError.message);
      return;
    }
    setToken(newToken);
  }

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!token) {
    return (
      <button
        type="button"
        onClick={() => issue()}
        disabled={busy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "만드는 중..." : "공개 링크 만들기"}
      </button>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.target.select()}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
        >
          {copied ? "복사됨!" : "링크 복사"}
        </button>
      </div>
      <button
        type="button"
        onClick={() =>
          issue(
            "새 링크를 발급하면 기존에 공유했던 링크는 더 이상 작동하지 않아요. 계속할까요?",
          )
        }
        disabled={busy}
        className="mt-2 text-xs text-red-600 hover:underline disabled:opacity-50"
      >
        {busy ? "발급 중..." : "새 링크 발급 (기존 링크는 무효화됩니다)"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function SettingsClient({
  schoolId,
  initialOrgName,
  initialLogoUrl,
  initialTimetableUrl,
  initialWeatherLat,
  initialWeatherLon,
  initialWeatherLocationName,
  initialPublicResultsToken,
}: {
  schoolId: string;
  initialOrgName: string;
  initialLogoUrl: string;
  initialTimetableUrl: string;
  initialWeatherLat: number;
  initialWeatherLon: number;
  initialWeatherLocationName: string;
  initialPublicResultsToken: string;
}) {
  const [orgName, setOrgName] = useState(initialOrgName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [timetableUrl, setTimetableUrl] = useState(initialTimetableUrl);
  const [weatherLat, setWeatherLat] = useState(initialWeatherLat);
  const [weatherLon, setWeatherLon] = useState(initialWeatherLon);
  const [weatherLocationName, setWeatherLocationName] = useState(initialWeatherLocationName);
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
        weather_lat: weatherLat,
        weather_lon: weatherLon,
        weather_location_name: weatherLocationName.trim() || "서울",
      })
      .eq("school_id", schoolId);
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
          대회 이름, 로고 이미지, 시간표 이미지, 날씨 지역을 바꿀 수 있어요. 로그인 화면, 상단
          메뉴, 브라우저 탭 제목, 시간표 팝업까지 전부 여기 값으로 바뀝니다. 다른 학교에서 이
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

        <div className="border-t border-slate-100 pt-4">
          <label className="block text-sm font-medium text-slate-700">
            날씨 표시 지역 (로그인 화면, 상단 메뉴)
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
              📍 {weatherLocationName}
            </span>
            <span className="text-xs text-slate-400">
              ({weatherLat.toFixed(3)}, {weatherLon.toFixed(3)})
            </span>
          </div>
          <LocationSearch
            onPick={({ name, lat, lon }) => {
              setWeatherLocationName(name);
              setWeatherLat(lat);
              setWeatherLon(lon);
            }}
          />
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

      <div className="max-w-lg rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">
          공개 결과 링크 (담임선생님·교직원용, 로그인 불필요)
        </label>
        <p className="mt-1 text-xs text-slate-400">
          이 링크로 들어가면 로그인 없이 &ldquo;학년별 종합 순위&rdquo;만 실시간으로 볼 수
          있어요. 링크 자체가 비밀번호 역할을 하니, 필요한 분들에게만 전달해주세요. 링크가
          퍼졌거나 더 이상 못 쓰게 하고 싶으면 아래에서 새로 발급할 수 있어요.
        </p>
        <div className="mt-2">
          <PublicResultsLink schoolId={schoolId} initialToken={initialPublicResultsToken} />
        </div>
      </div>
    </div>
  );
}
