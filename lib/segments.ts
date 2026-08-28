/**
 * SMS segment counting.
 *
 * Carriers bill per 160-character segment, but only for text that fits the
 * GSM-03.38 alphabet. A single character outside it -- an emoji, or the curly
 * apostrophe Word inserts when you type "don't" -- forces the whole message
 * into UCS-2, where a segment is only 70 characters. That silently turns a
 * two-segment announcement into three or four.
 *
 * This module exists so the compose box can warn about that *before* someone
 * sends to four hundred people.
 */

/** Characters representable in a single GSM-03.38 septet. */
const GSM_BASIC = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
    "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);

/** GSM extension characters. These cost two septets each, not one. */
const GSM_EXTENDED = new Set("^{}\\[~]|€");

const GSM_SINGLE_LIMIT = 160;
const GSM_MULTI_LIMIT = 153; // 7 septets go to the concatenation header
const UCS2_SINGLE_LIMIT = 70;
const UCS2_MULTI_LIMIT = 67; // 3 UTF-16 units go to the header

export type Encoding = "GSM-7" | "UCS-2";

export interface SegmentInfo {
  encoding: Encoding;
  /** Billable segments. Always at least 1, even for an empty body. */
  segments: number;
  /** Characters as a human counts them (astral chars count as one). */
  characters: number;
  /** Units consumed against the per-segment limit for this encoding. */
  billedUnits: number;
  /** Units still available before another segment is added. */
  remainingInSegment: number;
  /**
   * Characters that forced UCS-2, deduplicated and capped. Empty when the
   * message is GSM-7. Used to offer "replace these" in the composer.
   */
  offendingCharacters: string[];
}

/**
 * Count GSM-7 septets, or return null if any character is unrepresentable.
 */
function countGsmUnits(text: string): number | null {
  let units = 0;
  for (const char of text) {
    if (GSM_BASIC.has(char)) {
      units += 1;
    } else if (GSM_EXTENDED.has(char)) {
      units += 2;
    } else {
      return null;
    }
  }
  return units;
}

/** Characters outside GSM-7, in order of first appearance, max 10. */
function findOffenders(text: string): string[] {
  const seen = new Set<string>();
  for (const char of text) {
    if (!GSM_BASIC.has(char) && !GSM_EXTENDED.has(char)) {
      seen.add(char);
      if (seen.size >= 10) break;
    }
  }
  return [...seen];
}

export function analyzeMessage(body: string): SegmentInfo {
  const text = body ?? "";
  const characters = [...text].length;
  const gsmUnits = countGsmUnits(text);

  if (gsmUnits !== null) {
    const segments =
      gsmUnits <= GSM_SINGLE_LIMIT
        ? 1
        : Math.ceil(gsmUnits / GSM_MULTI_LIMIT);
    const limit = segments === 1 ? GSM_SINGLE_LIMIT : GSM_MULTI_LIMIT;
    return {
      encoding: "GSM-7",
      segments: Math.max(1, segments),
      characters,
      billedUnits: gsmUnits,
      remainingInSegment: segments * limit - gsmUnits,
      offendingCharacters: [],
    };
  }

  // UCS-2 bills per UTF-16 code unit, so an emoji outside the BMP costs two.
  const units = text.length;
  const segments =
    units <= UCS2_SINGLE_LIMIT ? 1 : Math.ceil(units / UCS2_MULTI_LIMIT);
  const limit = segments === 1 ? UCS2_SINGLE_LIMIT : UCS2_MULTI_LIMIT;

  return {
    encoding: "UCS-2",
    segments: Math.max(1, segments),
    characters,
    billedUnits: units,
    remainingInSegment: segments * limit - units,
    offendingCharacters: findOffenders(text),
  };
}

/**
 * Common typography that sneaks in from Word, Google Docs, and phone
 * keyboards, mapped to GSM-safe equivalents. Applying this is usually the
 * difference between a 3-segment and a 2-segment message.
 */
const SMART_CHARACTER_REPLACEMENTS: Array<[RegExp, string]> = [
  [/[‘’‚‛′]/g, "'"], // curly single quotes, prime
  [/[“”„‟″]/g, '"'], // curly double quotes
  [/[–—―]/g, "-"], // en/em dash
  [/…/g, "..."], // ellipsis
  [/[   ]/g, " "], // non-breaking spaces
  [/[•·]/g, "-"], // bullets
  [/™/g, "(TM)"],
  [/[←-⇿]/g, "->"], // arrows
];

/**
 * Replace smart punctuation with GSM-safe equivalents. Does not strip emoji --
 * that is a content decision the sender should make deliberately, so the
 * composer surfaces them instead.
 */
export function normalizeTypography(body: string): string {
  let text = body ?? "";
  for (const [pattern, replacement] of SMART_CHARACTER_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

/** True when normalising typography would actually save a segment. */
export function typographyWouldSaveSegments(body: string): number {
  const before = analyzeMessage(body).segments;
  const after = analyzeMessage(normalizeTypography(body)).segments;
  return Math.max(0, before - after);
}
