"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type Slide = {
  id: string; kind: "announcement" | "event"; label: string; title: string;
  meta?: string; copy?: string | null; image?: string | null;
  month?: string; day?: string; href?: string | null; external?: boolean;
};

const AUTO_MS = 6500;

export function HighlightsCarousel({ slides }: { slides: Slide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [pages, setPages] = useState(1);
  const [paused, setPaused] = useState(false);

  // How many "pages" the track has at the current width, and which one is showing.
  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const card = el.firstElementChild as HTMLElement | null;
    const step = card ? card.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0") : el.clientWidth;
    const perView = Math.max(1, Math.round(el.clientWidth / step));
    const count = Math.max(1, slides.length - perView + 1);
    setPages(count);
    setActive(Math.min(count - 1, Math.round(el.scrollLeft / step)));
  }, [slides.length]);

  const goTo = useCallback((index: number) => {
    const el = track.current;
    if (!el) return;
    const cards = el.children;
    const target = cards[Math.max(0, Math.min(cards.length - 1, index))] as HTMLElement | undefined;
    if (target) el.scrollTo({ left: target.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }, []);

  useEffect(() => {
    measure();
    const el = track.current;
    if (!el) return;
    const onScroll = () => window.requestAnimationFrame(measure);
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure);
    return () => { el.removeEventListener("scroll", onScroll); window.removeEventListener("resize", measure); };
  }, [measure]);

  // Gentle auto-advance; stops while someone is looking or for reduced motion.
  useEffect(() => {
    if (paused || pages < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => goTo(active + 1 >= pages ? 0 : active + 1), AUTO_MS);
    return () => window.clearInterval(timer);
  }, [active, pages, paused, goTo]);

  return (
    <section className="highlights" aria-roledescription="carousel" aria-label="Happening at Beulah">
      <div className="wrap">
        <div className="highlights-head">
          <div>
            <p className="eyebrow">Happening at Beulah</p>
            <h2>Announcements &amp; events</h2>
          </div>
          <div className="highlights-tools">
            <Link className="text-link" href="/fellowships-events#events">Full calendar <span>→</span></Link>
            {pages > 1 && (
              <div className="highlights-arrows">
                <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous">‹</button>
                <button type="button" onClick={() => goTo(active + 1)} disabled={active >= pages - 1} aria-label="Next">›</button>
              </div>
            )}
          </div>
        </div>
        <div
          className="highlights-track" ref={track} tabIndex={0}
          onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} onTouchStart={() => setPaused(true)}
        >
          {slides.map((s, i) => <Card slide={s} key={s.id} index={i} total={slides.length} />)}
        </div>
        {pages > 1 && (
          <div className="highlights-dots" role="group" aria-label="Choose slide">
            {Array.from({ length: pages }, (_, i) => (
              <button type="button" key={i} className={i === active ? "on" : ""} onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`} aria-current={i === active} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Card({ slide: s, index, total }: { slide: Slide; index: number; total: number }) {
  const body = (
    <>
      <div className={`hl-media ${s.image ? "" : "hl-media-plain"}`}>
        {s.image ? (
          <>
            <img className="hl-media-bg" src={s.image} alt="" aria-hidden="true" />
            <img className="hl-media-img" src={s.image} alt="" loading={index < 3 ? "eager" : "lazy"} />
          </>
        ) : s.kind === "event" ? (
          <div className="hl-date-big"><small>{s.month}</small><b>{s.day}</b></div>
        ) : (
          <div className="hl-mark"><img src="/images/logo-horizontal-white.png" alt="" /></div>
        )}
        <span className={`hl-badge ${s.kind}`}>{s.kind === "event" ? "Event" : "Announcement"}</span>
      </div>
      <div className="hl-body">
        {s.label && <p className="hl-label">{s.label}</p>}
        <h3>{s.title}</h3>
        {s.meta && <p className="hl-meta">{s.meta}</p>}
        {s.copy && <p className="hl-copy">{s.copy}</p>}
        {s.href && <span className="hl-more">{s.kind === "event" ? "See the calendar" : "Learn more"} →</span>}
      </div>
    </>
  );
  const common = { className: "hl-card", role: "group", "aria-roledescription": "slide", "aria-label": `${index + 1} of ${total}: ${s.title}` } as const;
  if (!s.href) return <article {...common}>{body}</article>;
  if (s.external) return <a {...common} href={s.href} target="_blank" rel="noreferrer">{body}</a>;
  return <Link {...common} href={s.href}>{body}</Link>;
}
