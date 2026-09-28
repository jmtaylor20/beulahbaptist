import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, configuredPin } from "../../mileage/access";

// Redirect with a relative Location so the browser stays on the domain it
// used (behind Netlify, request.url carries the internal deploy hostname).
const backToLog = (query = "", cookie?: string) => {
  const headers = new Headers({ Location: `/mileage${query}` });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
};

export async function POST(request: Request) {
  const pin = configuredPin();
  const entered = String((await request.formData()).get("pin") ?? "").trim();

  if (!pin || entered !== pin) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return backToLog(pin ? "?error=1" : "");
  }

  return backToLog("", `${ACCESS_COOKIE}=${await accessToken(pin)}; Path=/; Max-Age=${ACCESS_MAX_AGE}; HttpOnly; Secure; SameSite=Lax`);
}
