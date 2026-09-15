/**
 * Re-encode the site's photos to the size they are actually displayed at.
 *
 * The originals are camera-resolution: several are 1800px wide and ~450KB
 * while being displayed in a 416px card. Together they were about 4MB, which
 * dominated page weight — far more than any rendering change.
 *
 * Targets below are roughly 2x the largest measured display width (so they
 * stay sharp on retina screens), capped at the source's own resolution.
 *
 * USAGE
 *   npm run build && npx next start -p 4321 &   # serves public/ for reading
 *   node scripts/optimize-images.mjs
 *
 * NOTE: this is lossy and writes in place. Re-running it re-compresses
 * already-compressed files. If you need to redo it, restore the originals
 * from git first (`git checkout -- public/images`) and run it once.
 */

import { chromium } from "playwright";
import { statSync, writeFileSync } from "node:fs";

const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:4321";

/** file -> { width: max output width, quality, format } */
const TARGETS = {
  // Full-bleed hero backgrounds: already efficient, just capped and re-encoded.
  "church-hero.jpg": { width: 1800, quality: 0.82 },
  "church-aerial.jpg": { width: 1800, quality: 0.82 },
  // Wide feature image.
  "children.jpg": { width: 1200, quality: 0.76 },
  // Grid cards, displayed ~416px.
  "youth.jpg": { width: 900, quality: 0.82 },
  "joy.jpg": { width: 900, quality: 0.82 },
  "outreach.jpg": { width: 900, quality: 0.82 },
  // Portrait, displayed ~372px.
  "pastor-timothy-davis.jpg": { width: 800, quality: 0.84 },
  // Seal, displayed at most 150px. Needs transparency, so PNG plus a WebP.
  "logo-seal.png": { width: 320, quality: 0.92, alsoWebp: true },
};

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });

let before = 0;
let after = 0;

for (const [file, target] of Object.entries(TARGETS)) {
  const path = `public/images/${file}`;
  const originalBytes = statSync(path).size;

  const encoded = await page.evaluate(
    async ({ src, width, quality, isPng, alsoWebp }) => {
      const img = new Image();
      img.src = src;
      await img.decode();

      const scale = Math.min(1, width / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      return {
        main: canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality),
        webp: alsoWebp ? canvas.toDataURL("image/webp", quality) : null,
        size: [canvas.width, canvas.height],
      };
    },
    {
      src: `/images/${file}`,
      width: target.width,
      quality: target.quality,
      isPng: file.endsWith(".png"),
      alsoWebp: Boolean(target.alsoWebp),
    }
  );

  const bytes = Buffer.from(encoded.main.split(",")[1], "base64");

  // Never make a file bigger. Canvas PNG encoding in particular can lose to a
  // well-optimised source.
  if (bytes.length >= originalBytes) {
    console.log(
      `${file.padEnd(28)} kept original (re-encode was larger: ` +
        `${(bytes.length / 1024).toFixed(0)}KB vs ${(originalBytes / 1024).toFixed(0)}KB)`
    );
    before += originalBytes;
    after += originalBytes;
  } else {
    writeFileSync(path, bytes);
    console.log(
      `${file.padEnd(28)} ${encoded.size.join("x").padEnd(11)} ` +
        `${(originalBytes / 1024).toFixed(0).padStart(4)}KB -> ${(bytes.length / 1024).toFixed(0).padStart(4)}KB`
    );
    before += originalBytes;
    after += bytes.length;
  }

  if (encoded.webp) {
    const webpBytes = Buffer.from(encoded.webp.split(",")[1], "base64");
    const webpPath = path.replace(/\.(png|jpg)$/, ".webp");
    writeFileSync(webpPath, webpBytes);
    console.log(
      `${"".padEnd(28)} + ${webpPath.split("/").pop()} ${(webpBytes.length / 1024).toFixed(0)}KB`
    );
  }
}

console.log(
  `\ntotal ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB ` +
    `(${(100 - (after / before) * 100).toFixed(0)}% smaller)`
);

await browser.close();
