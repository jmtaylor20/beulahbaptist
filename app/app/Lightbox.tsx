"use client";
import { useEffect, useState } from "react";

// Wraps a photo so tapping it opens a full-screen view. Used in the directory
// so members can get a proper look at a face, not just a thumbnail.
export function Lightbox({ src, name, children }: { src: string | null; name: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open]);
  if (!src) return <>{children}</>;
  return (
    <>
      <button type="button" className="ma-photo-button" onClick={() => setOpen(true)} aria-label={`See a larger photo of ${name}`}>{children}</button>
      {open && (
        <div className="ma-lightbox" onClick={() => setOpen(false)} role="dialog" aria-label={name}>
          <img src={src} alt={name} />
          <p>{name}</p>
          <span className="ma-lightbox-close" aria-hidden>×</span>
        </div>
      )}
    </>
  );
}
