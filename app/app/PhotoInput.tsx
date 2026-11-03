"use client";
import { useRef, useState } from "react";

// A file input that shrinks the chosen photo in the browser before the form
// is submitted. Phone photos are 3 to 8 MB; the server accepts far less and
// the directory only shows small images anyway. Output is a JPEG no wider or
// taller than 1200px, which lands around 150 to 400 KB.
export function PhotoInput({ name, capture }: { name: string; capture?: "user" | "environment" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");

  async function onChange() {
    const input = ref.current;
    const file = input?.files?.[0];
    if (!input || !file) return;
    try {
      setNote("Preparing photo…");
      const shrunk = await shrink(file);
      const dt = new DataTransfer();
      dt.items.add(shrunk);
      input.files = dt.files;
      setNote(`Ready (${Math.round(shrunk.size / 1024)} KB)`);
    } catch {
      // Could not decode (rare). Leave the original; the server will say if it is too big.
      setNote(file.size > 4 * 1024 * 1024 ? "This photo is very large and may not upload. Try a smaller one." : "");
    }
  }

  return (
    <>
      <input ref={ref} name={name} type="file" accept="image/*" capture={capture} onChange={onChange} />
      {note && <span className="hint">{note}</span>}
    </>
  );
}

async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("encode failed");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}
