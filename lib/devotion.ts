// A year through the Bible: 1,189 chapters spread evenly over 365 days,
// Genesis to Revelation. Day 1 is January 1. Scripture text comes from
// API.Bible in the member's chosen translation.

const BOOKS: [string, string, number][] = [
  ["GEN", "Genesis", 50], ["EXO", "Exodus", 40], ["LEV", "Leviticus", 27], ["NUM", "Numbers", 36], ["DEU", "Deuteronomy", 34],
  ["JOS", "Joshua", 24], ["JDG", "Judges", 21], ["RUT", "Ruth", 4], ["1SA", "1 Samuel", 31], ["2SA", "2 Samuel", 24],
  ["1KI", "1 Kings", 22], ["2KI", "2 Kings", 25], ["1CH", "1 Chronicles", 29], ["2CH", "2 Chronicles", 36], ["EZR", "Ezra", 10],
  ["NEH", "Nehemiah", 13], ["EST", "Esther", 10], ["JOB", "Job", 42], ["PSA", "Psalms", 150], ["PRO", "Proverbs", 31],
  ["ECC", "Ecclesiastes", 12], ["SNG", "Song of Solomon", 8], ["ISA", "Isaiah", 66], ["JER", "Jeremiah", 52], ["LAM", "Lamentations", 5],
  ["EZK", "Ezekiel", 48], ["DAN", "Daniel", 12], ["HOS", "Hosea", 14], ["JOL", "Joel", 3], ["AMO", "Amos", 9],
  ["OBA", "Obadiah", 1], ["JON", "Jonah", 4], ["MIC", "Micah", 7], ["NAM", "Nahum", 3], ["HAB", "Habakkuk", 3],
  ["ZEP", "Zephaniah", 3], ["HAG", "Haggai", 2], ["ZEC", "Zechariah", 14], ["MAL", "Malachi", 4],
  ["MAT", "Matthew", 28], ["MRK", "Mark", 16], ["LUK", "Luke", 24], ["JHN", "John", 21], ["ACT", "Acts", 28],
  ["ROM", "Romans", 16], ["1CO", "1 Corinthians", 16], ["2CO", "2 Corinthians", 13], ["GAL", "Galatians", 6], ["EPH", "Ephesians", 6],
  ["PHP", "Philippians", 4], ["COL", "Colossians", 4], ["1TH", "1 Thessalonians", 5], ["2TH", "2 Thessalonians", 3], ["1TI", "1 Timothy", 6],
  ["2TI", "2 Timothy", 4], ["TIT", "Titus", 3], ["PHM", "Philemon", 1], ["HEB", "Hebrews", 13], ["JAS", "James", 5],
  ["1PE", "1 Peter", 5], ["2PE", "2 Peter", 3], ["1JN", "1 John", 5], ["2JN", "2 John", 1], ["3JN", "3 John", 1],
  ["JUD", "Jude", 1], ["REV", "Revelation", 22],
];

const CHAPTERS: { code: string; book: string; chapter: number }[] = [];
for (const [code, book, count] of BOOKS) for (let c = 1; c <= count; c++) CHAPTERS.push({ code, book, chapter: c });
const TOTAL = CHAPTERS.length; // 1189

// Translations available through API.Bible. The first three are public
// domain and work with any key; the others need the free license request in
// the API.Bible dashboard, then their IDs go in the BIBLE_IDS env variable as
// "CSB=<id>,ESV=<id>,NIV=<id>".
export const TRANSLATIONS: Record<string, { name: string; id: string }> = {
  KJV: { name: "King James Version", id: "de4e12af7f28f599-02" },
  WEB: { name: "World English Bible", id: "9879dbb7cfe39e4d-04" },
  ASV: { name: "American Standard Version", id: "06125adad2d5898a-01" },
  ...Object.fromEntries((process.env.BIBLE_IDS ?? "").split(",").filter((s) => s.includes("=")).map((s) => { const [k, id] = s.split("="); return [k.trim(), { name: { CSB: "Christian Standard Bible", ESV: "English Standard Version", NIV: "New International Version", NLT: "New Living Translation", NASB: "New American Standard Bible", NKJV: "New King James Version" }[k.trim()] ?? k.trim(), id: id.trim() }]; })),
};

export function dayOfYear(date = new Date()) {
  const central = new Date(date.toLocaleString("en-US", { timeZone: "America/Chicago" }));
  const start = new Date(central.getFullYear(), 0, 1);
  return Math.min(365, Math.floor((central.getTime() - start.getTime()) / 86400000) + 1);
}

export function readingForDay(day: number) {
  const from = Math.floor(((day - 1) * TOTAL) / 365);
  const to = Math.min(TOTAL, Math.floor((day * TOTAL) / 365)) - 1;
  const chapters = CHAPTERS.slice(from, to + 1);
  // Group consecutive chapters of the same book into "Genesis 1-3" ranges.
  const ranges: { code: string; book: string; first: number; last: number }[] = [];
  for (const ch of chapters) {
    const last = ranges[ranges.length - 1];
    if (last && last.code === ch.code && last.last === ch.chapter - 1) last.last = ch.chapter;
    else ranges.push({ code: ch.code, book: ch.book, first: ch.chapter, last: ch.chapter });
  }
  const label = ranges.map((r) => `${r.book} ${r.first}${r.last > r.first ? `-${r.last}` : ""}`).join("; ");
  const passageIds = ranges.map((r) => `${r.code}.${r.first}${r.last > r.first ? `-${r.code}.${r.last}` : ""}`);
  return { day, label, ranges, passageIds };
}

export const todaysReading = () => readingForDay(dayOfYear());

export type Passage = { reference: string; html: string };

// Fetches passage HTML from API.Bible. Returns null when no key is configured
// or the request fails, and the page falls back to a link.
export async function fetchPassages(translation: string, passageIds: string[]): Promise<Passage[] | null> {
  const key = process.env.BIBLE_API_KEY;
  const bible = TRANSLATIONS[translation] ?? TRANSLATIONS.KJV;
  if (!key) return null;
  try {
    const out: Passage[] = [];
    for (const id of passageIds) {
      const res = await fetch(`https://api.scripture.api.bible/v1/bibles/${bible.id}/passages/${id}?content-type=html&include-notes=false&include-titles=true&include-chapter-numbers=false&include-verse-numbers=true&include-verse-spans=false`, {
        headers: { "api-key": key }, next: { revalidate: 60 * 60 * 24 },
      });
      if (!res.ok) return null;
      const json = await res.json();
      out.push({ reference: json.data.reference, html: json.data.content });
    }
    return out;
  } catch {
    return null;
  }
}

// Link for reading on the web when we cannot fetch text ourselves.
export const bibleGatewayUrl = (label: string, translation: string) =>
  `https://www.biblegateway.com/passage/?search=${encodeURIComponent(label)}&version=${encodeURIComponent(translation)}`;
