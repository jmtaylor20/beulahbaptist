import {
  consumeSignInToken,
  sessionCookieHeader,
} from "../../../../lib/auth";

export const dynamic = "force-dynamic";

/**
 * Land here from the emailed link. Exchanges the one-time token for a session
 * cookie and redirects into the admin area.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const result = await consumeSignInToken(token);

  if (!result) {
    return Response.redirect(
      new URL("/admin/signin?error=expired", url.origin).toString(),
      302
    );
  }

  const secure = url.protocol === "https:";

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL("/admin", url.origin).toString(),
      "Set-Cookie": sessionCookieHeader(result.sessionToken, { secure }),
    },
  });
}
