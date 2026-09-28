import { hasAccess } from "../../mileage/access";

// Looks up round-trip driving miles for the pastor's mileage log.
// Street addresses are geocoded with the U.S. Census geocoder (it knows rural
// Tallapoosa County addresses that OpenStreetMap does not), with OpenStreetMap
// as a fallback for place names like "Russell Medical". Driving distance comes
// from the public OSRM router. All three services are free and need no key.

const ORIGINS = {
  home: { label: "Home", address: "1151 Wildlife Road, Dadeville, AL 36853", lon: -85.815223852586, lat: 32.663032220063 },
  church: { label: "Church", address: "5891 Lovelady Road, Dadeville, AL 36853", lon: -85.853313563451, lat: 32.65171396767 },
} as const;

type Origin = keyof typeof ORIGINS;
type Point = { lon: number; lat: number; matched: string };

const METERS_PER_MILE = 1609.344;
const TIMEOUT_MS = 8000;

async function censusLookup(address: string): Promise<Point | null> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.search = new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" }).toString();
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = await res.json();
  const match = data?.result?.addressMatches?.[0];
  if (!match) return null;
  return { lon: match.coordinates.x, lat: match.coordinates.y, matched: match.matchedAddress };
}

async function osmLookup(query: string): Promise<Point | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  // Prefer results around Tallapoosa County without excluding the rest of the country.
  url.search = new URLSearchParams({ q: query, format: "jsonv2", limit: "1", countrycodes: "us", viewbox: "-86.4,33.2,-85.3,32.3" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": "BeulahBaptistMileageLog/1.0" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const [hit] = await res.json();
  if (!hit) return null;
  return { lon: Number(hit.lon), lat: Number(hit.lat), matched: hit.display_name };
}

async function geocode(query: string): Promise<Point | null> {
  const attempts: (() => Promise<Point | null>)[] = [() => censusLookup(query)];
  if (!/\b(AL|Alabama)\b/i.test(query)) attempts.push(() => censusLookup(`${query}, AL`));
  attempts.push(() => osmLookup(query));
  for (const attempt of attempts) {
    try {
      const point = await attempt();
      if (point) return point;
    } catch {
      // Try the next service.
    }
  }
  return null;
}

async function drivingMeters(stops: { lon: number; lat: number }[]): Promise<number | null> {
  const coords = stops.map((p) => `${p.lon},${p.lat}`).join(";");
  // continue_straight=false lets the route turn around at the destination.
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false&continue_straight=false`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.code === "Ok" ? data.routes[0].distance : null;
}

export async function GET(request: Request) {
  if (!(await hasAccess())) return Response.json({ error: "Please unlock the mileage log again." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const from = params.get("from") as Origin | null;
  const to = params.get("to")?.trim() ?? "";
  if (!from || !(from in ORIGINS) || !to || to.length > 200) {
    return Response.json({ error: "Choose a starting point and enter a destination." }, { status: 400 });
  }

  const start = ORIGINS[from];
  const dest = await geocode(to);
  if (!dest) {
    return Response.json({ error: "Couldn’t find that address. Check the spelling, add the city, or enter the miles by hand." }, { status: 404 });
  }

  let meters: number | null = null;
  try {
    meters = await drivingMeters([start, dest, start]);
  } catch {
    meters = null;
  }
  if (meters === null) {
    return Response.json({ error: "Found the address but couldn’t get driving miles right now. Enter the miles by hand." }, { status: 502 });
  }

  const roundTrip = Math.round((meters / METERS_PER_MILE) * 10) / 10;
  return Response.json(
    { from: start.label, matchedAddress: dest.matched, roundTripMiles: roundTrip, oneWayMiles: Math.round((roundTrip / 2) * 10) / 10 },
    { headers: { "Cache-Control": "private, max-age=86400" } },
  );
}
