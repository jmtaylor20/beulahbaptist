import Link from "next/link";
import { base, requireMember } from "../../../../lib/members";
import { TRANSLATIONS, bibleGatewayUrl, dayOfYear, fetchPassages, readingForDay } from "../../../../lib/devotion";

export const metadata = { title: "Daily reading" };

export default async function Devotion({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const me = await requireMember();
  const b = await base();
  const sp = await searchParams;
  const today = dayOfYear();
  const day = Math.min(365, Math.max(1, Number(sp.day) || today));
  const reading = readingForDay(day);
  const translation = TRANSLATIONS[me.bible_translation] ? me.bible_translation : "KJV";
  const passages = await fetchPassages(translation, reading.passageIds);
  const devotionLink = process.env.DEVOTION_LINK_URL;

  return (
    <div className="ma-devotion">
      <p className="eyebrow">A year through the Bible · Day {day} of 365</p>
      <h1>{reading.label}</h1>
      <p className="ma-lead">{TRANSLATIONS[translation].name}. <Link href={`${b}/profile`}>Change translation</Link></p>
      <nav className="ma-tabs">
        {day > 1 && <a href={`?day=${day - 1}`}>← Yesterday</a>}
        {day !== today && <a href="?" className="is-active">Today</a>}
        {day < 365 && <a href={`?day=${day + 1}`}>Tomorrow →</a>}
      </nav>

      {passages ? passages.map((p) => (
        <section key={p.reference} className="ma-card">
          <h2 className="ref">{p.reference}</h2>
          <div className="passage" dangerouslySetInnerHTML={{ __html: p.html }} />
        </section>
      )) : (
        <section className="ma-card">
          <p>Read today&rsquo;s passage on Bible Gateway in your translation.</p>
          <a className="button navy" href={bibleGatewayUrl(reading.label, translation)} target="_blank" rel="noreferrer">Open {reading.label} ↗</a>
        </section>
      )}

      {devotionLink && (
        <section className="ma-card navy">
          <p className="eyebrow light">Today&rsquo;s devotional</p>
          <p>A short daily devotion from a Southern Baptist source to go with your reading.</p>
          <a className="button gold" href={devotionLink} target="_blank" rel="noreferrer">Read today&rsquo;s devotion ↗</a>
        </section>
      )}
    </div>
  );
}
