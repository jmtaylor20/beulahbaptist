/**
 * AWS Signature Version 4 signing, implemented on WebCrypto.
 *
 * The AWS SDK is far too heavy for a Worker when the only thing we need is a
 * single signed POST to the SES endpoint.
 */

const encoder = new TextEncoder();
const HEX = "0123456789abcdef";

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let out = "";
  for (const byte of bytes) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

async function sha256Hex(data: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", encoder.encode(data)));
}

async function hmac(
  key: ArrayBuffer | Uint8Array,
  data: string
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
}

export interface SigV4Options {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region: string;
  service: string;
  method: string;
  url: string;
  body: string;
  headers?: Record<string, string>;
}

/**
 * Returns the headers to attach to the request, including Authorization.
 */
export async function signRequest(
  options: SigV4Options
): Promise<Record<string, string>> {
  const url = new URL(options.url);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-date": amzDate,
    ...Object.fromEntries(
      Object.entries(options.headers ?? {}).map(([key, value]) => [
        key.toLowerCase(),
        value,
      ])
    ),
  };
  if (options.sessionToken) {
    headers["x-amz-security-token"] = options.sessionToken;
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = signedHeaderNames.join(";");

  const payloadHash = await sha256Hex(options.body);

  // Query parameters must be sorted and percent-encoded per RFC 3986.
  const queryParams = [...url.searchParams.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  const canonicalQuery = queryParams
    .map(
      ([key, value]) =>
        `${encodeRfc3986(key)}=${encodeRfc3986(value)}`
    )
    .join("&");

  const canonicalRequest = [
    options.method.toUpperCase(),
    url.pathname || "/",
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const scope = `${dateStamp}/${options.region}/${options.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    await sha256Hex(canonicalRequest),
  ].join("\n");

  let signingKey: ArrayBuffer = await hmac(
    encoder.encode(`AWS4${options.secretAccessKey}`),
    dateStamp
  );
  signingKey = await hmac(signingKey, options.region);
  signingKey = await hmac(signingKey, options.service);
  signingKey = await hmac(signingKey, "aws4_request");

  const signature = toHex(await hmac(signingKey, stringToSign));

  return {
    ...options.headers,
    "X-Amz-Date": amzDate,
    ...(options.sessionToken
      ? { "X-Amz-Security-Token": options.sessionToken }
      : {}),
    Authorization:
      `AWS4-HMAC-SHA256 Credential=${options.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
}

/** encodeURIComponent leaves !'()* alone; AWS requires them encoded. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}
