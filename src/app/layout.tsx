import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "체육대회 점수 관리",
  description: "체육대회 반대항전 및 단합 미니게임 점수 입력/집계 시스템",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
