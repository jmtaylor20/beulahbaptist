import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

// Supabase sends email-confirmation and password-reset links here. We swap the
// code for a session, then continue to the requested page.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";
  if (code) {
    const supabase = await supabaseServer();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
