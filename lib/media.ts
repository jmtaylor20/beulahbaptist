/**
 * Image storage for MMS.
 *
 * Twilio fetches the media itself over the public internet, so the bytes have
 * to live somewhere it can reach. They go in R2 and are served back from
 * /media/<id>, where the id is 32 random hex characters -- unguessable, which
 * is the same protection a Twilio-hosted media URL has.
 */

import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { mediaAssets } from "../db/schema";
import { generateToken } from "./tokens";

/**
 * Carriers reject or badly degrade large MMS. Twilio resizes png/gif/jpeg
 * automatically, but 5MB is the hard ceiling for the whole request and
 * anything over ~600KB risks a resize failure at AT&T, so we cap on upload
 * rather than discovering it mid-broadcast.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const RECOMMENDED_MAX_BYTES = 600 * 1024;

/** Formats every US carrier handles, and that Twilio will resize for us. */
export const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
]);

function getBucket(): R2Bucket {
  const bucket = env.MEDIA;
  if (!bucket) {
    throw new Error(
      "Cloudflare R2 binding `MEDIA` is unavailable. Set the `r2` field in " +
        ".openai/hosting.json to `MEDIA` so picture messages can be stored."
    );
  }
  return bucket;
}

export function isMediaConfigured(): boolean {
  try {
    getBucket();
    return true;
  } catch {
    return false;
  }
}

export interface StoredMedia {
  id: string;
  contentType: string;
  byteSize: number;
  originalName: string;
}

export async function storeMedia(options: {
  bytes: ArrayBuffer;
  contentType: string;
  originalName: string;
  uploadedBy: number | null;
}): Promise<StoredMedia> {
  if (!ALLOWED_MIME_TYPES.has(options.contentType)) {
    throw new Error(
      `Unsupported image type "${options.contentType}". Use a JPEG, PNG, or GIF.`
    );
  }
  if (options.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error("That image is larger than 5MB, which carriers reject.");
  }

  const id = generateToken(16);
  const extension = options.contentType.split("/")[1].replace("jpeg", "jpg");
  const key = `mms/${id}.${extension}`;

  await getBucket().put(key, options.bytes, {
    httpMetadata: { contentType: options.contentType },
  });

  const db = getDb();
  await db.insert(mediaAssets).values({
    id,
    key,
    contentType: options.contentType,
    byteSize: options.bytes.byteLength,
    originalName: options.originalName.slice(0, 200),
    uploadedBy: options.uploadedBy,
  });

  return {
    id,
    contentType: options.contentType,
    byteSize: options.bytes.byteLength,
    originalName: options.originalName,
  };
}

export async function getMedia(id: string): Promise<{
  body: ReadableStream;
  contentType: string;
  size: number;
} | null> {
  const db = getDb();
  const [record] = await db
    .select()
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);

  if (!record) return null;

  const object = await getBucket().get(record.key);
  if (!object) return null;

  return {
    body: object.body,
    contentType:
      object.httpMetadata?.contentType ?? record.contentType ?? "image/jpeg",
    size: object.size,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
