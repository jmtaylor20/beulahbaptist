"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatCost } from "../../../../lib/pricing";
import {
  analyzeMessage,
  normalizeTypography,
  typographyWouldSaveSegments,
} from "../../../../lib/segments";

export interface GroupOption {
  id: number;
  name: string;
  smsCount: number;
  emailCount: number;
}

interface UploadedMedia {
  id: string;
  sizeLabel: string;
  oversized: boolean;
  originalName: string;
  previewUrl: string;
}

interface Preview {
  kind: "sms" | "mms" | "email";
  recipients: number;
  segmentsPerRecipient: number;
  perRecipient: number;
  total: number;
  renderedBody: string;
}

export function Composer({
  groups,
  footerText,
  smsReady,
  emailReady,
  mediaReady,
}: {
  groups: GroupOption[];
  footerText: string;
  smsReady: boolean;
  emailReady: boolean;
  mediaReady: boolean;
}) {
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [includeFooter, setIncludeFooter] = useState(true);
  const [media, setMedia] = useState<UploadedMedia | null>(null);

  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<{ sent: number; failed: number } | null>(
    null
  );
  const fileInput = useRef<HTMLInputElement>(null);

  const isMms = channel === "sms" && media !== null;

  /**
   * Local estimate, recomputed on every keystroke. The server re-prices before
   * sending, but doing the arithmetic here keeps the counter instant and
   * works even when the network is slow.
   */
  const local = useMemo(() => {
    const rendered =
      channel === "sms" && includeFooter ? body + footerText : body;
    const analysis = analyzeMessage(rendered);
    const reach = selected.reduce((total, id) => {
      const group = groups.find((candidate) => candidate.id === id);
      if (!group) return total;
      return total + (channel === "sms" ? group.smsCount : group.emailCount);
    }, 0);

    return {
      analysis,
      rendered,
      // Group membership overlaps, so this is an upper bound until the server
      // returns the deduplicated count.
      approxReach: reach,
      savings: typographyWouldSaveSegments(rendered),
    };
  }, [body, channel, includeFooter, footerText, selected, groups]);

  // Ask the server for the authoritative (deduplicated) audience and price.
  useEffect(() => {
    const controller = new AbortController();

    // All state changes happen inside the timer, never synchronously in the
    // effect body, which would trigger a cascading render on every keystroke.
    const timer = setTimeout(async () => {
      if (selected.length === 0 || !body.trim()) {
        setPreview(null);
        return;
      }

      try {
        const response = await fetch("/api/admin/broadcasts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "preview",
            channel,
            body,
            subject,
            groupIds: selected,
            mediaId: media?.id ?? null,
            includeFooter,
          }),
          signal: controller.signal,
        });
        const payload = (await response.json()) as {
          preview?: Preview;
          error?: string;
        };
        if (response.ok && payload.preview) setPreview(payload.preview);
      } catch {
        // An aborted or failed preview just leaves the local estimate showing.
      }
    }, 400);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [channel, body, subject, selected, media, includeFooter]);

  const recipients = preview?.recipients ?? local.approxReach;
  const total = preview?.total ?? 0;
  const ready =
    recipients > 0 &&
    body.trim().length > 0 &&
    (channel === "sms" ? smsReady : emailReady) &&
    (channel !== "email" || subject.trim().length > 0);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/admin/media", {
        method: "POST",
        body: form,
      });
      const payload = (await response.json()) as {
        media?: Omit<UploadedMedia, "previewUrl">;
        error?: string;
      };

      if (!response.ok || !payload.media) {
        setError(payload.error ?? "That image could not be uploaded.");
        return;
      }
      setMedia({
        ...payload.media,
        previewUrl: URL.createObjectURL(file),
      });
    } catch {
      setError("The image upload failed. Check your connection.");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    const headline = isMms ? "picture message" : channel === "email" ? "email" : "text";
    const confirmed = window.confirm(
      `Send this ${headline} to ${recipients} ${
        recipients === 1 ? "person" : "people"
      } for about ${formatCost(total)}?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          channel,
          body,
          subject,
          groupIds: selected,
          mediaId: media?.id ?? null,
          includeFooter,
          confirmTotal: total,
        }),
      });
      const payload = (await response.json()) as {
        sent?: number;
        failed?: number;
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "The message could not be sent.");
        return;
      }
      setSent({ sent: payload.sent ?? 0, failed: payload.failed ?? 0 });
    } catch {
      setError("The send request failed. Check the history page before retrying.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="card">
        <div className="notice notice-ok">
          <p>
            <strong>
              Sent to {sent.sent} {sent.sent === 1 ? "person" : "people"}.
            </strong>{" "}
            {sent.failed > 0
              ? `${sent.failed} could not be reached — see the history page for which.`
              : "Delivery receipts will appear on the history page shortly."}
          </p>
        </div>
        <div className="btn-row">
          <a className="btn btn-primary" href="/admin/broadcasts">
            View history
          </a>
          <button
            className="btn btn-quiet"
            type="button"
            onClick={() => {
              setSent(null);
              setBody("");
              setSubject("");
              setMedia(null);
            }}
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid-2">
      <div>
        {error && (
          <div className="notice notice-error">
            <p>{error}</p>
          </div>
        )}

        {channel === "sms" && !smsReady && (
          <div className="notice notice-warn">
            <p>
              Twilio isn&rsquo;t configured yet, so texts can be composed and
              priced but not sent.
            </p>
          </div>
        )}
        {channel === "email" && !emailReady && (
          <div className="notice notice-warn">
            <p>
              Email isn&rsquo;t configured yet, so newsletters can be composed
              but not sent.
            </p>
          </div>
        )}

        <div className="card admin-form">
          <label>
            Send as
            <select
              value={channel}
              onChange={(event) => {
                setChannel(event.target.value as "sms" | "email");
                setSelected([]);
              }}
            >
              <option value="sms">Text message</option>
              <option value="email">Email</option>
            </select>
          </label>

          <label>
            Who should get this?
            <div className="checkbox-list">
              {groups.length === 0 && (
                <span className="hint">
                  No groups yet. Create one on the Groups page first.
                </span>
              )}
              {groups.map((group) => {
                const count =
                  channel === "sms" ? group.smsCount : group.emailCount;
                return (
                  <label key={group.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(group.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(group.id)
                            ? current.filter((id) => id !== group.id)
                            : [...current, group.id]
                        )
                      }
                    />
                    <span>{group.name}</span>
                    <span className="count">
                      {count} {channel === "sms" ? "phones" : "emails"}
                    </span>
                  </label>
                );
              })}
            </div>
          </label>

          {channel === "email" && (
            <label>
              Subject
              <input
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="This Sunday at Beulah"
              />
            </label>
          )}

          <label>
            Message
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={
                channel === "sms"
                  ? "Wednesday supper is cancelled tonight due to weather. Stay safe!"
                  : "Write the newsletter here."
              }
            />
          </label>

          {channel === "sms" && (
            <>
              <label className="inline-check">
                <input
                  type="checkbox"
                  checked={includeFooter}
                  onChange={(event) => setIncludeFooter(event.target.checked)}
                />
                <span>
                  Add &ldquo;Reply STOP to opt out&rdquo;
                  <span className="hint">
                    Carriers expect this periodically. Leaving it on is the safe
                    default.
                  </span>
                </span>
              </label>

              <label style={{ marginTop: 14 }}>
                Picture <span className="optional-tag">(optional)</span>
                {media ? (
                  <div
                    style={{
                      marginTop: 8,
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={media.previewUrl}
                      alt=""
                      style={{
                        width: 64,
                        height: 64,
                        objectFit: "cover",
                        borderRadius: 6,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.84rem",
                          textTransform: "none",
                          letterSpacing: "normal",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {media.originalName}
                      </div>
                      <div className="hint" style={{ marginTop: 2 }}>
                        {media.sizeLabel}
                        {media.oversized
                          ? " — large images can fail at some carriers"
                          : ""}
                      </div>
                    </div>
                    <button
                      className="btn btn-quiet"
                      type="button"
                      onClick={() => setMedia(null)}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInput}
                      type="file"
                      accept="image/jpeg,image/png,image/gif"
                      disabled={!mediaReady || uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void upload(file);
                      }}
                    />
                    <span className="hint">
                      {mediaReady
                        ? uploading
                          ? "Uploading…"
                          : "JPEG, PNG, or GIF. Adding a picture makes this an MMS."
                        : "Image storage isn't configured yet."}
                    </span>
                  </>
                )}
              </label>
            </>
          )}
        </div>
      </div>

      <div className="cost-panel">
        <div className="card">
          <h3>Before you send</h3>
          <div className="cost-figure">{formatCost(total)}</div>
          <div className="cost-sub">
            {recipients} {recipients === 1 ? "recipient" : "recipients"}
            {preview ? "" : " (estimated)"}
          </div>

          <div className="meter-rows">
            <div className="meter-row">
              <span>Type</span>
              <span>
                {channel === "email"
                  ? "Email"
                  : isMms
                    ? "Picture text (MMS)"
                    : "Text (SMS)"}
              </span>
            </div>
            {channel === "sms" && (
              <>
                <div className="meter-row">
                  <span>Characters</span>
                  <span>{local.analysis.characters}</span>
                </div>
                <div className="meter-row">
                  <span>Segments each</span>
                  <span>
                    {isMms ? "1 (billed per message)" : local.analysis.segments}
                  </span>
                </div>
                <div className="meter-row">
                  <span>Encoding</span>
                  <span>{local.analysis.encoding}</span>
                </div>
              </>
            )}
            <div className="meter-row">
              <span>Cost each</span>
              <span>
                {preview ? formatCost(preview.perRecipient) : "—"}
              </span>
            </div>
          </div>

          {channel === "sms" &&
            !isMms &&
            local.analysis.encoding === "UCS-2" && (
              <div className="encoding-warn">
                <strong>This message costs extra.</strong> A character outside
                the standard set drops every segment from 160 characters to 70.
                {local.analysis.offendingCharacters.length > 0 && (
                  <>
                    {" "}
                    Found:{" "}
                    {local.analysis.offendingCharacters.map((char, index) => (
                      <code key={index}>{char}</code>
                    ))}
                  </>
                )}
                {local.savings > 0 && (
                  <>
                    <br />
                    <button
                      type="button"
                      onClick={() => setBody(normalizeTypography(body))}
                    >
                      Fix punctuation and save {local.savings} segment
                      {local.savings === 1 ? "" : "s"} each
                    </button>
                  </>
                )}
              </div>
            )}

          <div className="btn-row" style={{ marginTop: 20 }}>
            <button
              className="btn btn-gold"
              type="button"
              disabled={!ready || sending}
              onClick={send}
            >
              {sending ? "Sending…" : `Send to ${recipients}`}
            </button>
          </div>
        </div>

        {channel === "sms" && (
          <div className="card">
            <h3>Preview</h3>
            <div className="phone-preview">
              <div className="bubble">
                {media && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media.previewUrl} alt="" />
                )}
                {local.rendered || "Your message will appear here."}
              </div>
              <div className="bubble-meta">
                {isMms
                  ? "Delivered as a picture message"
                  : `${local.analysis.segments} segment${
                      local.analysis.segments === 1 ? "" : "s"
                    }`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
