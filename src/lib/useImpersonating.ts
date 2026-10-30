"use client";

import { useEffect, useState } from "react";

// 총괄자가 "관리자로 로그인"해서 들어온 세션인지 여부. 실제로는 그 학교
// 관리자 본인의 세션이지만(그래야 기존 RLS가 그대로 동작하므로), 화면에는
// 그 관리자의 개인정보(이름/이메일) 대신 총괄자 본인임을 보여줘야 한다.
export function useImpersonating(): boolean {
  const [impersonating, setImpersonating] = useState(false);
  useEffect(() => {
    const readCookie = () =>
      setImpersonating(document.cookie.split("; ").includes("impersonating=1"));
    readCookie();
  }, []);
  return impersonating;
}
