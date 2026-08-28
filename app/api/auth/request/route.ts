import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../../db";
import { signInTokens, staff } from "../../../../db/schema";
import { requestSignInLink } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

const MAX_LINKS_PER_WINDOW = 5;
const WINDOW_SECONDS = 15 * 60;

/**
 * Send a sign-in link.
 *
 * Always replies 200 with the same message. Whether the address is on staff or
 * not is not something an unauthenticated caller gets to learn.
 */
export async function POST(request: Request) {
  // Every path ends here, so the response never reveals whether the address
  // exists, was rate limited, or hit an internal error.
  const acknowledge = () =>
    new Response(null, {
      status: 303,
      headers: {
        Location: new URL(
          "/admin/signin?sent=1",
          new URL(request.url).origin
        ).toString(),
      },
    });

  try {
    const form = await request.formData();
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();

    if (!email) return acknowledge();
    if (await isRateLimited(email)) return acknowledge();

    await requestSignInLink(email, request);
    return acknowledge();
  } catch (error) {
    console.error("[auth/request] failed", error);
    return acknowledge();
  }
}

/**
 * Cap how many links one address can trigger, so the endpoint cannot be used
 * to bomb a staff member's inbox. Counted off the tokens table rather than a
 * separate store, since every issued link already writes a row there.
 */
async function isRateLimited(email: string): Promise<boolean> {
  const db = getDb();
  const [account] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(eq(staff.email, email))
    .limit(1);

  if (!account) return false;

  const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();
  const recent = await db
    .select({ id: signInTokens.id })
    .from(signInTokens)
    .where(
      and(
        eq(signInTokens.staffId, account.id),
        gt(signInTokens.createdAt, since)
      )
    )
    .limit(MAX_LINKS_PER_WINDOW + 1);

  return recent.length >= MAX_LINKS_PER_WINDOW;
}
