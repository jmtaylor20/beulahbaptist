import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, configuredPin } from "../../mileage/access";

export async function POST(request: Request) {
  const pin = configuredPin();
  const entered = String((await request.formData()).get("pin") ?? "").trim();
  const back = (query = "") => new URL(`/mileage${query}`, request.url);

  if (!pin || entered !== pin) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Response.redirect(back(pin ? "?error=1" : ""), 303);
  }

  const response = Response.redirect(back(), 303);
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", `${ACCESS_COOKIE}=${await accessToken(pin)}; Path=/; Max-Age=${ACCESS_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
  return new Response(null, { status: 303, headers });
}
