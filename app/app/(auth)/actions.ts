"use server";
import { redirect } from "next/navigation";
import { base } from "../../../lib/members";
import { supabaseServer } from "../../../lib/supabase/server";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const bounce = (path: string, params: Record<string, string>) => redirect(`${path}?${new URLSearchParams(params)}`);

export async function signIn(form: FormData) {
  const b = await base();
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email: text(form, "email"), password: text(form, "password") });
  if (error) bounce(`${b}/login`, { error: "That email and password did not match." });
  await ensurePerson(); // signup cannot create the people row while email confirmation is on
  redirect(b || "/");
}

export async function signOut() {
  const b = await base();
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect(`${b}/login`);
}

// New family request: one login per household. Creates the login, the
// household, and a pending people row for the person signing up. An admin
// approves it from the portal; after that they add the rest of the family.
export async function requestAccess(form: FormData) {
  const b = await base();
  const supabase = await supabaseServer();
  const email = text(form, "email").toLowerCase();
  const password = text(form, "password");
  const first = text(form, "first_name"), last = text(form, "last_name");
  if (!first || !last || !email || password.length < 8) bounce(`${b}/signup`, { error: "Please fill in every field. Passwords need at least 8 characters." });

  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { first_name: first, last_name: last, phone: text(form, "phone"), request_note: text(form, "request_note"), family_name: text(form, "family_name") } } });
  if (error || !data.user) bounce(`${b}/signup`, { error: error?.message ?? "Could not create your account." });

  // With email confirmation on, there is no session yet; the rows are
  // created on first sign-in instead (see ensurePerson).
  if (data.session) await ensurePerson();
  redirect(`${b}/pending`);
}

// Creates the household and pending people row for the signed-in login if
// they are missing. Safe to call on every sign-in.
export async function ensurePerson() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase.from("people").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (existing) return;
  const meta = user.user_metadata ?? {};
  const last = meta.last_name ?? "";
  const { data: householdId } = await supabase.rpc("signup_household", { p_name: meta.family_name || (last ? `The ${last} Family` : "New family") });
  await supabase.from("people").insert({
    auth_user_id: user.id,
    household_id: householdId ?? null,
    first_name: meta.first_name ?? "",
    last_name: last,
    email: user.email,
    phone: meta.phone || null,
    request_note: meta.request_note || null,
    role: "head",
    status: "pending",
  });
}

export async function sendReset(form: FormData) {
  const b = await base();
  const supabase = await supabaseServer();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.beulahbaptistchurch.com";
  await supabase.auth.resetPasswordForEmail(text(form, "email"), { redirectTo: `${origin}${b}/auth/callback?next=${b}/profile/password` });
  bounce(`${b}/login`, { ok: "If that email is on file, a reset link is on its way." });
}

export async function updatePassword(form: FormData) {
  const b = await base();
  const supabase = await supabaseServer();
  const password = text(form, "password");
  if (password.length < 8) bounce(`${b}/profile/password`, { error: "Passwords need at least 8 characters." });
  const { error } = await supabase.auth.updateUser({ password });
  if (error) bounce(`${b}/profile/password`, { error: error.message });
  bounce(`${b}/profile`, { ok: "Password updated." });
}
