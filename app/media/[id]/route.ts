import { getMedia } from "../../../lib/media";

export const dynamic = "force-dynamic";

/**
 * Serve an MMS image.
 *
 * Deliberately unauthenticated: Twilio's media fetcher has no session and no
 * API key to present. The 32-hex-character id is the access control, so ids
 * must never be listed anywhere public.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!/^[0-9a-f]{32}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const media = await getMedia(id);
    if (!media) return new Response("Not found", { status: 404 });

    return new Response(media.body, {
      headers: {
        "Content-Type": media.contentType,
        "Content-Length": String(media.size),
        // Immutable: an id always maps to the same bytes.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[media] fetch failed", error);
    return new Response("Not found", { status: 404 });
  }
}
