import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses row-level security, so it is only used from
// server code that has already checked the caller is a church admin (sending
// the newsletter, signing photo URLs in bulk). Never import this in a client component.
export const supabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
