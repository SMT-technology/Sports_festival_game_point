import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/public-results",
  "/api/public-results",
  "/api/logo-proxy",
];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "super_admin" ? "/super/schools" : "/input";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, must_change_password")
      .eq("id", user.id)
      .single();

    // 총괄자는 특정 학교에 속하지 않으므로 학교별 화면(입력/응원/관리자 등)
    // 대신 총괄자 전용 화면(/super, /api/super)으로만 다닐 수 있게 한다.
    // /api/super/...는 "/super"로 시작하지 않으므로(두 prefix를 다 검사해야
    // 함) 빠뜨리면 총괄자가 /api/super/* API를 호출할 때마다 /super/schools
    // 페이지로 리다이렉트되어 API가 아예 실행되지 못하는 문제가 생긴다.
    if (profile?.role === "super_admin") {
      if (!path.startsWith("/super") && !path.startsWith("/api/super")) {
        const url = request.nextUrl.clone();
        url.pathname = "/super/schools";
        url.search = "";
        return NextResponse.redirect(url);
      }
      return response;
    }

    // /api/super/*는 여기서 건드리지 않는다 — 그 라우트 안의
    // requireSuperAdminApi()가 이미 403 JSON으로 거부하므로, 여기서
    // 리다이렉트시키면 API 호출자가 JSON 대신 HTML 리다이렉트를 받게 된다.
    if (path.startsWith("/super")) {
      const url = request.nextUrl.clone();
      url.pathname = "/input";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (profile?.must_change_password && path !== "/change-password") {
      const url = request.nextUrl.clone();
      url.pathname = "/change-password";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (path.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/input";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
