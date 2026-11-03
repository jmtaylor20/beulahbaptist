"use client";
import { useEffect, useRef, useState } from "react";

// A file input that prepares the chosen photo in the browser before the form
// is submitted. Phone photos are 3 to 8 MB; the server accepts far less and
// the directory only shows small images anyway.
//
// crop="square": shows a cropper (drag to move, slider to zoom) and outputs an
// 800x800 JPEG. Used for people and family photos.
// no crop: shrinks to at most 1200px on the long side. Used for flyers.
export function PhotoInput({ name, capture, crop }: { name: string; capture?: "user" | "environment"; crop?: "square" }) {
  const ref = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState("");
  const [src, setSrc] = useState<ImageBitmap | null>(null);

  async function onChange() {
    const input = ref.current;
    const file = input?.files?.[0];
    if (!input || !file) return;
    try {
      setNote("Preparing photo…");
      const bitmap = await createImageBitmap(file);
      if (crop === "square") { setSrc(bitmap); setNote(""); return; }
      const out = await render(bitmap, 1200, null);
      bitmap.close();
      setFile(input, out, file.name);
      setNote(`Ready (${Math.round(out.size / 1024)} KB)`);
    } catch {
      setNote(file.size > 4 * 1024 * 1024 ? "This photo is very large and may not upload. Try a smaller one." : "");
    }
  }

  return (
    <>
      <input ref={ref} name={name} type="file" accept="image/*" capture={capture} onChange={onChange} />
      {note && <span className="hint">{note}</span>}
      {src && crop === "square" && (
        <Cropper bitmap={src} onDone={async (blob) => {
          if (ref.current) setFile(ref.current, blob, ref.current.files?.[0]?.name ?? "photo");
          src.close(); setSrc(null); setNote(`Ready (${Math.round(blob.size / 1024)} KB)`);
        }} onCancel={() => { src.close(); setSrc(null); if (ref.current) ref.current.value = ""; }} />
      )}
    </>
  );
}

function setFile(input: HTMLInputElement, blob: Blob, originalName: string) {
  const dt = new DataTransfer();
  dt.items.add(new File([blob], originalName.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
  input.files = dt.files;
}

// Draws the bitmap to a canvas. With a crop, `view` is the source rectangle.
async function render(bitmap: ImageBitmap, max: number, view: { sx: number; sy: number; sw: number; sh: number } | null): Promise<Blob> {
  const sw = view ? view.sw : bitmap.width, sh = view ? view.sh : bitmap.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, view?.sx ?? 0, view?.sy ?? 0, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("encode failed");
  return blob;
}

// Square cropper: the photo sits behind a fixed 260px window. Drag to move,
// slide to zoom. Everything is in "window pixels"; we convert back to source
// pixels when the member taps Use photo.
function Cropper({ bitmap, onDone, onCancel }: { bitmap: ImageBitmap; onDone: (b: Blob) => void; onCancel: () => void }) {
  const SIZE = 260;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const base = SIZE / Math.min(bitmap.width, bitmap.height); // zoom 1 = photo's short side fills the window
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 }); // offset of the photo's centre from the window centre
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const scale = base * zoom;
  const w = bitmap.width * scale, h = bitmap.height * scale;
  const clamp = (p: { x: number; y: number }) => ({ x: Math.max(-(w - SIZE) / 2, Math.min((w - SIZE) / 2, p.x)), y: Math.max(-(h - SIZE) / 2, Math.min((h - SIZE) / 2, p.y)) });

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const p = clamp(pos);
    ctx.drawImage(bitmap, SIZE / 2 - w / 2 + p.x, SIZE / 2 - h / 2 + p.y, w, h);
  });

  const start = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; (e.target as Element).setPointerCapture(e.pointerId); };
  const move = (e: React.PointerEvent) => { if (!drag.current) return; setPos(clamp({ x: drag.current.px + e.clientX - drag.current.x, y: drag.current.py + e.clientY - drag.current.y })); };
  const end = () => { drag.current = null; };

  async function finish() {
    const p = clamp(pos);
    const sx = (w / 2 - p.x - SIZE / 2) / scale, sy = (h / 2 - p.y - SIZE / 2) / scale, s = SIZE / scale;
    onDone(await render(bitmap, 800, { sx, sy, sw: s, sh: s }));
  }

  return (
    <div className="ma-cropper">
      <canvas ref={canvasRef} width={SIZE} height={SIZE} onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end} style={{ touchAction: "none" }} />
      <label>Zoom<input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => { const z = Number(e.target.value); setZoom(z); setPos((p) => p); }} /></label>
      <p className="hint">Drag the photo to position it. The circle is what members will see.</p>
      <div className="ma-actions">
        <button type="button" className="button small navy" onClick={finish}>Use photo</button>
        <button type="button" className="button small quiet" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
