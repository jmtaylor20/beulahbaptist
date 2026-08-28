import { requireStaff } from "../../../../lib/auth";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  RECOMMENDED_MAX_BYTES,
  formatBytes,
  storeMedia,
} from "../../../../lib/media";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStaff(request);
  if (auth.response) return auth.response;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return Response.json({ error: "No image was uploaded." }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return Response.json(
        {
          error: `Carriers only accept JPEG, PNG, and GIF images. That file is "${
            file.type || "unknown"
          }".`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `That image is ${formatBytes(
            file.size
          )}. Carriers reject anything over 5MB.`,
        },
        { status: 400 }
      );
    }

    const stored = await storeMedia({
      bytes: await file.arrayBuffer(),
      contentType: file.type,
      originalName: file.name,
      uploadedBy: auth.user.id,
    });

    return Response.json({
      ok: true,
      media: {
        ...stored,
        sizeLabel: formatBytes(stored.byteSize),
        // Surfaced in the composer -- Twilio will still resize, but a large
        // original is the usual cause of a carrier-side resize failure.
        oversized: stored.byteSize > RECOMMENDED_MAX_BYTES,
      },
    });
  } catch (error) {
    console.error("[admin/media] upload failed", error);
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not store the image.",
      },
      { status: 500 }
    );
  }
}
