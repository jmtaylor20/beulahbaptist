/**
 * Generate small favicon and apple-touch-icon files from the church seal.
 *
 * The layout previously pointed icon, shortcut, and apple-touch-icon all at
 * the full-size logo-seal.png. That is a 192KB download, fetched twice on
 * every page load (once as the favicon, once as the touch icon) — more weight
 * than every photo on the page combined.
 *
 * Run with the site served locally, same as optimize-images.mjs.
 */
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const ORIGIN = process.env.ORIGIN ?? "http://127.0.0.1:4321";
const SIZES = [
  { file: "public/favicon-32.png", size: 32 },
  { file: "public/apple-touch-icon.png", size: 180 },
];

const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const page = await browser.newPage();
await page.goto(ORIGIN, { waitUntil: "domcontentloaded" });

for (const { file, size } of SIZES) {
  const url = await page.evaluate(async (target) => {
    const img = new Image();
    img.src = "/images/logo-seal.png";
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = target;
    canvas.height = target;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Apple touch icons are composited on a solid tile by iOS, so give them a
    // white ground rather than letting the OS pick.
    if (target >= 180) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, target, target);
    }
    ctx.drawImage(img, 0, 0, target, target);
    return canvas.toDataURL("image/png");
  }, size);

  const bytes = Buffer.from(url.split(",")[1], "base64");
  writeFileSync(file, bytes);
  console.log(`${file.padEnd(32)} ${size}x${size}  ${(bytes.length / 1024).toFixed(1)} KB`);
}

await browser.close();
