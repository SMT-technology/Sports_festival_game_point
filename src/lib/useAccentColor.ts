"use client";

import { useEffect, useState } from "react";

export interface AccentPalette {
  from: string;
  via: string;
  to: string;
}

// 학교 로고 URL이 없거나, CORS 등의 이유로 이미지에서 색을 뽑지 못할 때도
// 학교마다 항상 같은(=안정적인) 고유 색이 나오도록, 이름 문자열을 해시해서
// 0~359 범위의 색상(hue)값을 만든다.
function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function paletteFromHue(hue: number): AccentPalette {
  return {
    from: `hsl(${hue}, 72%, 52%)`,
    via: `hsl(${(hue + 35) % 360}, 68%, 50%)`,
    to: `hsl(${(hue + 80) % 360}, 72%, 54%)`,
  };
}

function rgbToHue(r: number, g: number, b: number): number {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  if (d === 0) return 0;
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

// 로고 이미지를 작게 그려서 평균 색상(채도가 있는 픽셀 위주)을 뽑아내고,
// 거기서 색상(hue)을 구해 그라디언트 팔레트를 만든다. 다른 사이트에
// 호스팅된 이미지라 CORS 정책 때문에 픽셀을 못 읽는 경우가 흔하므로
// (예: 일부 이미지 호스팅 서비스), 실패하면 학교 이름 기반 색으로 대체해
// 항상 그 학교만의 안정적인 색이 나오게 한다.
export function useAccentColor(logoUrl: string | undefined, seed: string): AccentPalette {
  const [palette, setPalette] = useState<AccentPalette>(() => paletteFromHue(hashHue(seed)));

  useEffect(() => {
    let cancelled = false;
    const fallback = () => {
      if (!cancelled) setPalette(paletteFromHue(hashHue(seed)));
    };

    if (!logoUrl) {
      fallback();
      return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 100) continue; // 투명 픽셀 제외
          const rr = data[i];
          const gg = data[i + 1];
          const bb = data[i + 2];
          const max = Math.max(rr, gg, bb);
          const min = Math.min(rr, gg, bb);
          const saturation = max === 0 ? 0 : (max - min) / max;
          if (saturation < 0.15) continue; // 흰색/검정/회색 위주 픽셀 제외
          r += rr;
          g += gg;
          b += bb;
          count++;
        }

        if (count < 5) throw new Error("not enough colorful pixels");
        const hue = rgbToHue(r / count, g / count, b / count);
        if (!cancelled) setPalette(paletteFromHue(hue));
      } catch {
        fallback();
      }
    };
    img.onerror = fallback;
    img.src = logoUrl;

    return () => {
      cancelled = true;
    };
  }, [logoUrl, seed]);

  return palette;
}
