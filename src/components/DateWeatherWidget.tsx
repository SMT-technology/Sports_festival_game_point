"use client";

import { useEffect, useState } from "react";

// WMO 날씨 코드 → 이모지/한글 설명 (Open-Meteo 기준). API 키가 필요 없는 무료
// 서비스라 브라우저에서 바로 호출한다 — 실패해도(오프라인 등) 날짜/시계는
// 그대로 보여주고 날씨 부분만 조용히 생략한다.
const WEATHER_CODE_INFO: Record<number, { emoji: string; label: string }> = {
  0: { emoji: "☀️", label: "맑음" },
  1: { emoji: "🌤️", label: "대체로 맑음" },
  2: { emoji: "⛅", label: "구름 조금" },
  3: { emoji: "☁️", label: "흐림" },
  45: { emoji: "🌫️", label: "안개" },
  48: { emoji: "🌫️", label: "안개" },
  51: { emoji: "🌦️", label: "이슬비" },
  53: { emoji: "🌦️", label: "이슬비" },
  55: { emoji: "🌧️", label: "이슬비" },
  56: { emoji: "🌧️", label: "어는 이슬비" },
  57: { emoji: "🌧️", label: "어는 이슬비" },
  61: { emoji: "🌧️", label: "비" },
  63: { emoji: "🌧️", label: "비" },
  65: { emoji: "🌧️", label: "강한 비" },
  66: { emoji: "🌧️", label: "어는 비" },
  67: { emoji: "🌧️", label: "어는 비" },
  71: { emoji: "🌨️", label: "눈" },
  73: { emoji: "🌨️", label: "눈" },
  75: { emoji: "❄️", label: "폭설" },
  77: { emoji: "🌨️", label: "싸락눈" },
  80: { emoji: "🌦️", label: "소나기" },
  81: { emoji: "🌧️", label: "소나기" },
  82: { emoji: "⛈️", label: "강한 소나기" },
  85: { emoji: "🌨️", label: "소낙눈" },
  86: { emoji: "🌨️", label: "소낙눈" },
  95: { emoji: "⛈️", label: "뇌우" },
  96: { emoji: "⛈️", label: "우박 동반 뇌우" },
  99: { emoji: "⛈️", label: "우박 동반 뇌우" },
};

function describeWeatherCode(code: number) {
  return WEATHER_CODE_INFO[code] ?? { emoji: "🌡️", label: "" };
}

interface WeatherState {
  temp: number;
  code: number;
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function useWeather(lat: number, lon: number) {
  const [weather, setWeather] = useState<WeatherState | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (cancelled) return;
        setWeather({ temp: json.current.temperature_2m, code: json.current.weather_code });
      } catch {
        // 오프라인 등으로 날씨를 못 가져와도 날짜/시계는 그대로 보여준다.
      }
    }
    load();
    const timer = setInterval(load, 1000 * 60 * 30);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [lat, lon]);
  return weather;
}

/** 상단 메뉴(NavBar)용 — 한 줄짜리 작은 표시 */
export function DateWeatherCompact({
  lat,
  lon,
  locationName,
}: {
  lat: number;
  lon: number;
  locationName: string;
}) {
  const now = useNow(1000 * 30);
  const weather = useWeather(lat, lon);
  if (!now) return null;

  const dateStr = now.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const info = weather ? describeWeatherCode(weather.code) : null;

  return (
    <div
      className="flex flex-wrap items-center justify-end gap-x-2 gap-y-0.5 whitespace-nowrap text-xs text-slate-500"
      title={locationName}
    >
      <span>{dateStr}</span>
      <span className="font-semibold text-slate-700">{timeStr}</span>
      {weather && info && (
        <span className="flex items-center gap-1 text-slate-500">
          <span>{info.emoji}</span>
          <span>{Math.round(weather.temp)}°</span>
        </span>
      )}
    </div>
  );
}

/** 로그인 화면용 — 카드 형태로 조금 더 크게 */
export function DateWeatherCard({
  lat,
  lon,
  locationName,
  className = "",
}: {
  lat: number;
  lon: number;
  locationName: string;
  className?: string;
}) {
  const now = useNow(1000 * 15);
  const weather = useWeather(lat, lon);
  if (!now) return null;

  const dateStr = now.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
  const timeStr = now.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  const info = weather ? describeWeatherCode(weather.code) : null;

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center shadow-sm backdrop-blur ${className}`}
    >
      <p className="text-xs font-medium text-slate-500">{dateStr}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">{timeStr}</p>
      {weather && info ? (
        <p className="mt-1 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          <span>{info.emoji}</span>
          <span className="font-semibold text-slate-700">{Math.round(weather.temp)}°C</span>
          <span>{info.label}</span>
          <span className="text-slate-400">· {locationName}</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-400">{locationName}</p>
      )}
    </div>
  );
}
