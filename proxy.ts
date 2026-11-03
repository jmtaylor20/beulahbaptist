import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Two jobs:
// 1. Serve the members app at the root of app.beulahbaptistchurch.com (and
//    app.bbcdadeville.com) by rewriting those requests to /app/... internally.
// 2. Keep the Supabase session fresh on every request so server components
//    always see a valid user.

const APP_HOSTS = /^app\./i;

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const onAppHost = APP_HOSTS.test(request.headers.get("host") ?? "");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-app-base", onAppHost ? "root" : "/app");

  let response: NextResponse;
  if (onAppHost && !url.pathname.startsWith("/app") && !url.pathname.startsWith("/_next") && !url.pathname.startsWith("/images") && !url.pathname.startsWith("/api")) {
    const rewritten = url.clone();
    rewritten.pathname = `/app${url.pathname === "/" ? "" : url.pathname}`;
    response = NextResponse.rewrite(rewritten, { request: { headers: requestHeaders } });
  } else if (onAppHost && url.pathname.startsWith("/app")) {
    // A link built for the main site landed on the subdomain; send it to the clean URL.
    const clean = url.clone();
    clean.pathname = url.pathname.replace(/^\/app/, "") || "/";
    return NextResponse.redirect(clean);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return response;
  if (!url.pathname.startsWith("/app") && !onAppHost) return response;

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|images|favicon|.*\\.(?:png|jpg|jpeg|webp|svg|ico|webmanifest)).*)"],
};
