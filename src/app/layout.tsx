import type { Metadata } from "next";
import "./globals.css";
import { getBranding } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const { orgName } = await getBranding();
  return {
    title: orgName,
    description: `${orgName} 반대항전 및 단합 미니게임 점수 입력/집계 시스템`,
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
