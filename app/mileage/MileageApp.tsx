"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";

// Trips are saved on the pastor's phone (localStorage). Nothing is stored on
// the server; the emailed report is the permanent record.

type Origin = "home" | "church";
type MilesMode = "manual" | "odometer" | "address";
type Trip = {
  id: string;
  date: string;
  from: Origin;
  places: string[];
  purpose: string;
  miles: number;
  address?: string;
  odoStart?: number;
  odoEnd?: number;
  sentAt?: string;
};
type Settings = { name: string; recipients: string; rate: string };
type Lookup = { state: "idle" | "loading" | "done" | "error"; message?: string };

const STORAGE_KEY = "bbc-mileage-v1";
const ORIGINS: Record<Origin, string> = { home: "Home", church: "Church" };
// His most frequent destinations from the 2020 to 2026 mileage spreadsheet.
const COMMON_PLACES = [
  "Dadeville", "Opelika", "Tallassee", "Reeltown", "Alexander City", "Auburn", "EAMC",
  "Baptist East", "Montgomery", "Camp Hill", "Notasulga", "Eclectic", "Talladega",
  "Birmingham", "UAB", "Millbrook", "Lafayette",
];
const DEFAULT_SETTINGS: Settings = {
  name: "Pastor Timothy R. Davis",
  recipients: "beulahbaptist@ymail.com, treasurer.beulahbaptist@gmail.com",
  rate: "0.76",
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const parseDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const shortDate = (iso: string) => parseDate(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const monthName = (iso: string) => parseDate(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });
const fmtMiles = (n: number) => `${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
const round1 = (n: number) => Math.round(n * 10) / 10;
const sumMiles = (trips: Trip[]) => round1(trips.reduce((t, x) => t + x.miles, 0));
const byDate = (a: Trip, b: Trip) => a.date.localeCompare(b.date);
const where = (t: Pick<Trip, "places" | "address">) => t.places.join(" / ") || t.address || "";
const tripLine = (t: Trip) => {
  const text = [where(t), t.purpose].filter(Boolean).join(", ");
  return t.odoStart !== undefined ? `${text} (odometer ${t.odoStart} to ${t.odoEnd})` : text;
};

function buildReport(trips: Trip[], settings: Settings) {
  const sorted = [...trips].sort(byDate);
  const total = sumMiles(sorted);
  const rate = parseFloat(settings.rate);
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const range = first === last ? shortDate(first) : `${shortDate(first)} to ${shortDate(last)}`;

  const lines = [`Mileage report for ${settings.name}`, "Beulah Baptist Church", `Trips from ${range}`, `Submitted ${shortDate(today())}`, ""];
  const months = new Map<string, Trip[]>();
  for (const t of sorted) {
    const key = t.date.slice(0, 7);
    months.set(key, [...(months.get(key) ?? []), t]);
  }
  for (const monthTrips of months.values()) {
    lines.push(monthName(monthTrips[0].date).toUpperCase());
    for (const t of monthTrips) lines.push(`${shortDate(t.date)}: ${tripLine(t)}: ${fmtMiles(t.miles)}`);
    if (months.size > 1) lines.push(`${monthName(monthTrips[0].date)} total: ${fmtMiles(sumMiles(monthTrips))}`);
    lines.push("");
  }
  lines.push(`TOTAL: ${fmtMiles(total)} across ${sorted.length} trip${sorted.length === 1 ? "" : "s"}`);
  if (rate > 0) lines.push(`Reimbursement at $${rate} per mile: $${(total * rate).toFixed(2)}`);
  return { subject: `Mileage Report: ${settings.name}, ${range}`, body: lines.join("\n") };
}

function loadSaved(): { trips: Trip[]; settings: Settings; storageOk: boolean } {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    localStorage.setItem(`${STORAGE_KEY}-check`, "1");
    const settings = { ...DEFAULT_SETTINGS, ...saved?.settings };
    // Phones set up before the church rate was added saved a blank rate.
    if (!settings.rate) settings.rate = DEFAULT_SETTINGS.rate;
    return { trips: saved?.trips ?? [], settings, storageOk: true };
  } catch {
    return { trips: [], settings: DEFAULT_SETTINGS, storageOk: false };
  }
}

const emptyForm = () => ({
  date: today(),
  from: "home" as Origin,
  places: [] as string[],
  otherPlace: "",
  purpose: "",
  mode: "manual" as MilesMode,
  miles: "",
  odoStart: "",
  odoEnd: "",
  address: "",
});
type Form = ReturnType<typeof emptyForm>;

// Rendered client-only (see MileageLoader), so it can read localStorage up front.
export default function MileageApp() {
  const [initial] = useState(loadSaved);
  const [trips, setTrips] = useState<Trip[]>(initial.trips);
  const [settings, setSettings] = useState<Settings>(initial.settings);
  const [form, setForm] = useState<Form>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [confirmSent, setConfirmSent] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // Ask the browser not to clear this data on its own.
    navigator.storage?.persist?.().catch(() => {});
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ trips, settings }));
    } catch {
      // storageOk already warns the pastor when saving isn't possible.
    }
  }, [trips, settings]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const ready = useMemo(() => trips.filter((t) => !t.sentAt).sort(byDate), [trips]);
  const sentGroups = useMemo(() => {
    const groups = new Map<string, Trip[]>();
    for (const t of trips) if (t.sentAt) groups.set(t.sentAt, [...(groups.get(t.sentAt) ?? []), t]);
    return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [trips]);
  const pastPurposes = useMemo(() => [...new Set(trips.map((t) => t.purpose).filter(Boolean))], [trips]);
  const extraPlaces = useMemo(
    () => [...new Set(trips.flatMap((t) => t.places).filter((p) => !COMMON_PLACES.includes(p)))],
    [trips],
  );

  const places = [...form.places, ...(form.otherPlace.trim() ? [form.otherPlace.trim()] : [])];
  const odoMiles = round1(parseFloat(form.odoEnd) - parseFloat(form.odoStart));
  const miles = form.mode === "odometer" ? odoMiles : round1(parseFloat(form.miles));

  // The last time he made this same trip, so he can reuse its miles with one tap.
  // Prefers a match on both place and purpose, then place alone.
  const placeKey = places.join("/").toLowerCase();
  const newestFirst = places.length ? [...trips].filter((t) => t.id !== editingId).sort(byDate).reverse() : [];
  const lastSame =
    newestFirst.find((t) => t.places.join("/").toLowerCase() === placeKey && t.purpose.toLowerCase() === form.purpose.trim().toLowerCase()) ??
    newestFirst.find((t) => t.places.join("/").toLowerCase() === placeKey);

  const update = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const togglePlace = (place: string) =>
    update({ places: form.places.includes(place) ? form.places.filter((p) => p !== place) : [...form.places, place] });

  const calculate = async () => {
    if (!form.address.trim()) {
      setLookup({ state: "error", message: "Enter the address first." });
      return;
    }
    setLookup({ state: "loading" });
    try {
      const res = await fetch(`/api/mileage-distance?${new URLSearchParams({ from: form.from, to: form.address.trim() })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      update({ miles: String(data.roundTripMiles) });
      setLookup({ state: "done", message: `${fmtMiles(data.roundTripMiles)} round trip from ${data.from} to ${data.matchedAddress}` });
    } catch (err) {
      setLookup({ state: "error", message: err instanceof Error && err.message ? err.message : "Couldn’t calculate right now. Type the miles instead." });
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!places.length && !form.purpose.trim() && !form.address.trim()) {
      setNotice("Pick where you went or add a description.");
      return;
    }
    if (!(miles > 0)) {
      setNotice(form.mode === "odometer" ? "The ending odometer should be higher than the starting one." : "Enter the miles for this trip.");
      return;
    }
    const trip: Omit<Trip, "id"> = {
      date: form.date,
      from: form.from,
      places,
      purpose: form.purpose.trim(),
      miles,
      ...(form.mode === "address" && form.address.trim() ? { address: form.address.trim() } : {}),
      ...(form.mode === "odometer" ? { odoStart: parseFloat(form.odoStart), odoEnd: parseFloat(form.odoEnd) } : {}),
    };
    if (editingId) {
      setTrips((all) => all.map((t) => (t.id === editingId ? { ...trip, id: t.id, sentAt: t.sentAt } : t)));
      setNotice("Trip updated.");
    } else {
      setTrips((all) => [...all, { ...trip, id: crypto.randomUUID() }]);
      setNotice(`Saved: ${fmtMiles(miles)} on ${shortDate(form.date)}.`);
    }
    // Keep the date, starting point and entry method, since he usually enters
    // several trips in a row. The next odometer start is this trip's end.
    setForm((f) => ({ ...emptyForm(), date: f.date, from: f.from, mode: f.mode, odoStart: f.mode === "odometer" ? f.odoEnd : "" }));
    setEditingId(null);
    setLookup({ state: "idle" });
  };

  const edit = (trip: Trip) => {
    setEditingId(trip.id);
    setForm({
      ...emptyForm(),
      date: trip.date,
      from: trip.from,
      places: trip.places.filter((p) => COMMON_PLACES.includes(p) || extraPlaces.includes(p)),
      purpose: trip.purpose,
      mode: trip.odoStart !== undefined ? "odometer" : trip.address ? "address" : "manual",
      miles: String(trip.miles),
      odoStart: trip.odoStart !== undefined ? String(trip.odoStart) : "",
      odoEnd: trip.odoEnd !== undefined ? String(trip.odoEnd) : "",
      address: trip.address ?? "",
    });
    setLookup({ state: "idle" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setLookup({ state: "idle" });
  };

  const remove = (trip: Trip) => {
    if (!confirm(`Delete the ${fmtMiles(trip.miles)} trip on ${shortDate(trip.date)}?`)) return;
    setTrips((all) => all.filter((t) => t.id !== trip.id));
    if (editingId === trip.id) cancelEdit();
  };

  const openEmail = (list: Trip[]) => {
    const { subject, body } = buildReport(list, settings);
    const to = settings.recipients.split(/[,;\s]+/).filter(Boolean).join(",");
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyReport = async (list: Trip[]) => {
    const { subject, body } = buildReport(list, settings);
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`);
      setNotice("Report copied. Paste it into an email or text.");
    } catch {
      setNotice("Couldn’t copy on this phone.");
    }
  };

  const markSent = () => {
    const stamp = new Date().toISOString();
    setTrips((all) => all.map((t) => (t.sentAt ? t : { ...t, sentAt: stamp })));
    setConfirmSent(false);
    setNotice("Marked as sent. You’re all caught up.");
  };

  const unsend = (stamp: string) => {
    if (!confirm("Move these trips back to “Ready to send”?")) return;
    setTrips((all) => all.map((t) => (t.sentAt === stamp ? { ...t, sentAt: undefined } : t)));
  };

  const deleteReport = (stamp: string, count: number) => {
    if (!confirm(`Permanently delete this sent report (${count} trips) from this phone?`)) return;
    setTrips((all) => all.filter((t) => t.sentAt !== stamp));
  };

  return (
    <div className="mileage-app">
      <header className="ml-header">
        <img src="/images/logo-seal.png" alt="" />
        <div>
          <p className="ml-kicker">Beulah Baptist Church</p>
          <h1>Mileage Log</h1>
        </div>
      </header>

      <main className="ml-main">
        {!initial.storageOk && <p className="ml-warning">This browser can’t save trips. If you’re in a private tab, open the page in a normal tab.</p>}

        <form className="ml-card" onSubmit={save}>
          <h2>{editingId ? "Edit trip" : "Add a trip"}</h2>

          <label className="ml-field">
            <span>Date of trip</span>
            <input type="date" value={form.date} max={today()} onChange={(e) => update({ date: e.target.value })} required />
          </label>

          <div className="ml-field">
            <span>Where did you go? <em>(tap all that apply)</em></span>
            <div className="ml-places">
              {[...COMMON_PLACES, ...extraPlaces].map((place) => (
                <button type="button" key={place} className="ml-chip" aria-pressed={form.places.includes(place)} onClick={() => togglePlace(place)}>
                  {place}
                </button>
              ))}
            </div>
            <input value={form.otherPlace} onChange={(e) => update({ otherPlace: e.target.value })} placeholder="Somewhere else…" autoComplete="off" aria-label="Other place" />
          </div>

          <label className="ml-field">
            <span>Who or what for</span>
            <input value={form.purpose} onChange={(e) => update({ purpose: e.target.value })} placeholder="Hospital visit, Sam’s Club…" list="ml-past-purpose" autoComplete="off" enterKeyHint="next" />
            <datalist id="ml-past-purpose">{pastPurposes.map((d) => <option value={d} key={d} />)}</datalist>
          </label>

          <div className="ml-field">
            <span>Miles</span>
            <div className="ml-toggle ml-toggle-3" role="group" aria-label="How to enter miles">
              {([["manual", "Type miles"], ["odometer", "Odometer"], ["address", "Address"]] as const).map(([mode, label]) => (
                <button type="button" key={mode} aria-pressed={form.mode === mode} onClick={() => { update({ mode }); setLookup({ state: "idle" }); }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {form.mode === "manual" && (
            <label className="ml-field">
              <span>Total trip miles</span>
              <input className="ml-big" type="number" inputMode="decimal" step="0.1" min="0.1" value={form.miles} onChange={(e) => update({ miles: e.target.value })} placeholder="0.0" />
            </label>
          )}

          {form.mode === "odometer" && (
            <>
              <div className="ml-pair">
                <label className="ml-field">
                  <span>Start</span>
                  <input type="number" inputMode="decimal" step="0.1" value={form.odoStart} onChange={(e) => update({ odoStart: e.target.value })} placeholder="135669" />
                </label>
                <label className="ml-field">
                  <span>End</span>
                  <input type="number" inputMode="decimal" step="0.1" value={form.odoEnd} onChange={(e) => update({ odoEnd: e.target.value })} placeholder="135686" />
                </label>
              </div>
              <p className="ml-hint ml-odo-result">{odoMiles > 0 ? <>Trip: <strong>{fmtMiles(odoMiles)}</strong></> : "Enter the odometer at the start and end of the trip."}</p>
            </>
          )}

          {form.mode === "address" && (
            <>
              <div className="ml-field">
                <span>Round trip from</span>
                <div className="ml-toggle" role="group" aria-label="Starting from">
                  {(Object.keys(ORIGINS) as Origin[]).map((key) => (
                    <button type="button" key={key} aria-pressed={form.from === key} onClick={() => { update({ from: key }); setLookup({ state: "idle" }); }}>
                      {ORIGINS[key]}
                    </button>
                  ))}
                </div>
              </div>
              <label className="ml-field">
                <span>Address</span>
                <input value={form.address} onChange={(e) => { update({ address: e.target.value }); setLookup({ state: "idle" }); }} placeholder="Street address, city" autoComplete="off" />
              </label>
              <div className="ml-miles">
                <input className="ml-big" type="number" inputMode="decimal" step="0.1" min="0.1" value={form.miles} onChange={(e) => update({ miles: e.target.value })} placeholder="0.0" aria-label="Round-trip miles" />
                <button type="button" className="ml-calc" onClick={calculate} disabled={lookup.state === "loading"}>
                  {lookup.state === "loading" ? "Working…" : "Calculate"}
                </button>
              </div>
              <p className={`ml-hint ${lookup.state === "error" ? "is-error" : ""}`} aria-live="polite">
                {lookup.message ?? "Tap Calculate for the round-trip driving miles. You can adjust the number after."}
              </p>
            </>
          )}

          {lastSame && form.mode !== "odometer" && String(lastSame.miles) !== form.miles && (
            <button type="button" className="ml-reuse" onClick={() => update({ miles: String(lastSame.miles) })}>
              Last time ({shortDate(lastSame.date)}): {fmtMiles(lastSame.miles)}. Tap to use.
            </button>
          )}

          <div className="ml-actions">
            <button type="submit" className="button navy">{editingId ? "Save changes" : "Save trip"}</button>
            {editingId && <button type="button" className="button outline" onClick={cancelEdit}>Cancel</button>}
          </div>
        </form>

        <section className="ml-card">
          <div className="ml-section-head">
            <h2>Ready to send</h2>
            {ready.length > 0 && <strong>{fmtMiles(sumMiles(ready))}</strong>}
          </div>
          {ready.length === 0 ? (
            <p className="ml-empty">No trips waiting. Trips you save show up here until you email them.</p>
          ) : (
            <>
              <ul className="ml-list">
                {ready.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="ml-trip" onClick={() => edit(t)} aria-label={`Edit trip on ${shortDate(t.date)}`}>
                      <span className="ml-trip-date">{shortDate(t.date)}</span>
                      <span className="ml-trip-route">{where(t) || t.purpose}</span>
                      {where(t) && t.purpose && <span className="ml-trip-purpose">{t.purpose}</span>}
                      <span className="ml-trip-miles">{fmtMiles(t.miles)}</span>
                    </button>
                    <button type="button" className="ml-delete" onClick={() => remove(t)} aria-label="Delete trip">×</button>
                  </li>
                ))}
              </ul>
              <p className="ml-count">{ready.length} trip{ready.length === 1 ? "" : "s"} · tap one to edit</p>
              {confirmSent ? (
                <div className="ml-confirm">
                  <p><strong>Did the email go out?</strong> Marking it sent moves these trips to your history so they aren’t sent twice.</p>
                  <div className="ml-actions">
                    <button type="button" className="button navy" onClick={markSent}>Yes, mark as sent</button>
                    <button type="button" className="button outline" onClick={() => setConfirmSent(false)}>Not yet</button>
                  </div>
                </div>
              ) : (
                <div className="ml-actions">
                  <button type="button" className="button gold ml-send" onClick={() => { openEmail(ready); setConfirmSent(true); }}>
                    Email report
                  </button>
                  <button type="button" className="ml-link" onClick={() => copyReport(ready)}>Copy report instead</button>
                </div>
              )}
            </>
          )}
        </section>

        {sentGroups.length > 0 && (
          <details className="ml-card ml-details">
            <summary>Sent reports <span>{sentGroups.length}</span></summary>
            <ul className="ml-history">
              {sentGroups.map(([stamp, list]) => {
                const sorted = [...list].sort(byDate);
                return (
                  <li key={stamp}>
                    <div>
                      <strong>Sent {new Date(stamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</strong>
                      <span>{list.length} trip{list.length === 1 ? "" : "s"} · {fmtMiles(sumMiles(list))} · {shortDate(sorted[0].date)} to {shortDate(sorted[sorted.length - 1].date)}</span>
                    </div>
                    <div className="ml-history-actions">
                      <button type="button" onClick={() => openEmail(list)}>Email again</button>
                      <button type="button" onClick={() => unsend(stamp)}>Move back</button>
                      <button type="button" onClick={() => deleteReport(stamp, list.length)}>Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </details>
        )}

        <details className="ml-card ml-details">
          <summary>Settings</summary>
          <label className="ml-field">
            <span>Name on report</span>
            <input value={settings.name} onChange={(e) => setSettings((s) => ({ ...s, name: e.target.value }))} />
          </label>
          <label className="ml-field">
            <span>Send report to</span>
            <textarea rows={2} value={settings.recipients} onChange={(e) => setSettings((s) => ({ ...s, recipients: e.target.value }))} />
          </label>
          <label className="ml-field">
            <span>Rate per mile <em>(adds a dollar total; 0 for miles only)</em></span>
            <input type="number" inputMode="decimal" step="0.001" min="0" placeholder="0.76" value={settings.rate} onChange={(e) => setSettings((s) => ({ ...s, rate: e.target.value }))} />
          </label>
          <p className="ml-hint">Trips are saved on this phone only. Always open the log from the home-screen icon, since Safari keeps a separate copy.</p>
        </details>
      </main>

      {notice && <div className="ml-toast" role="status">{notice}</div>}
    </div>
  );
}
