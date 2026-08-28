import { clearSessionCookieHeader, destroySession } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await destroySession(request);
  const url = new URL(request.url);

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/admin/signin", url.origin).toString(),
      "Set-Cookie": clearSessionCookieHeader(),
    },
  });
}
