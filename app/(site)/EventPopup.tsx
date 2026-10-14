"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

// Shown once per calendar day on the home page until the event is over.
const STORAGE_KEY = "beulah-popup-fall-bingo-2026";
const LAST_SHOW_DAY = "2026-10-17";

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function EventPopup() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const day = today();
    if (day > LAST_SHOW_DAY) return;
    let seen: string | null = null;
    try { seen = localStorage.getItem(STORAGE_KEY); } catch {}
    if (seen === day) return;
    const timer = window.setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, day); } catch {}
      setOpen(true);
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!open) return null;
  return (
    <div className="event-popup-backdrop" onClick={() => setOpen(false)}>
      <div className="event-popup" role="dialog" aria-modal="true" aria-labelledby="event-popup-title" onClick={(event) => event.stopPropagation()}>
        <button ref={closeRef} className="event-popup-close" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button>
        <h2 id="event-popup-title" className="sr-only">Fall Bingo Fundraiser — Saturday, October 17, 2026</h2>
        <Link href="/events/fall-bingo" onClick={() => setOpen(false)}>
          <img src="/images/fall-bingo-2026.webp" width={1545} height={1999} alt="Union Community Center Annual Fall Bingo Fundraiser, Saturday October 17, 2026, from 5:30 PM until the last prize is given, at 4191 Hwy 50, Dadeville, AL. Bingo, great prizes, concessions, fellowship, and a football game watch party." />
        </Link>
        <div className="event-popup-actions">
          <Link className="button gold" href="/events/fall-bingo" onClick={() => setOpen(false)}>Event details</Link>
          <button className="button outline" type="button" onClick={() => setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}
