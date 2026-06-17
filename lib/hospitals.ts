// Hospital / clinic locator using OpenStreetMap — free, no API key.
// Overpass for nearby facilities, Nominatim for geocoding a typed place.
const UA = "Bumply/1.0 (pregnancy companion; hello@thebrandnerve.com)";

export type Hospital = {
  id: string;
  name: string;
  kind: "hospital" | "clinic" | "other";
  lat: number;
  lon: number;
  distanceKm: number;
  phone?: string;
  address?: string;
  deliveryRecommended: boolean;
};

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export async function geocodePlace(place: string): Promise<{ lat: number; lon: number; label: string } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) return null;
  const arr = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  if (!arr[0]) return null;
  return { lat: Number(arr[0].lat), lon: Number(arr[0].lon), label: arr[0].display_name };
}

export async function findHospitals(lat: number, lon: number, radiusM = 8000): Promise<Hospital[]> {
  const a = `(around:${radiusM},${lat},${lon})`;
  const q = `[out:json][timeout:25];(
    node["amenity"="hospital"]${a};way["amenity"="hospital"]${a};
    node["amenity"="clinic"]${a};way["amenity"="clinic"]${a};
    node["healthcare"~"hospital|clinic|midwife|birthing_centre|centre"]${a};way["healthcare"~"hospital|clinic|centre"]${a};
  );out center tags 80;`;

  // Overpass public mirrors rate-limit / go down independently — try each in turn.
  const MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  ];
  let data: { elements?: Record<string, unknown>[] } | null = null;
  let lastErr: unknown = null;
  for (const url of MIRRORS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA },
        body: "data=" + encodeURIComponent(q),
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) { lastErr = new Error(`Overpass HTTP ${res.status}`); continue; }
      data = (await res.json()) as { elements?: Record<string, unknown>[] };
      break;
    } catch (e) { lastErr = e; }
  }
  if (!data) throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");

  const seen = new Set<string>();
  const out: Hospital[] = [];
  for (const el of data.elements || []) {
    const t = (el.tags || {}) as Record<string, string>;
    const name = t.name || t["name:en"];
    if (!name) continue;
    const center = el.center as { lat: number; lon: number } | undefined;
    const elat = (el.lat as number) ?? center?.lat;
    const elon = (el.lon as number) ?? center?.lon;
    if (elat == null || elon == null) continue;
    const key = name.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    const amen = (t.amenity || t.healthcare || "").toLowerCase();
    const kind: Hospital["kind"] = /hospital/.test(amen) ? "hospital" : /clinic|doctor|midwife|centre|birthing/.test(amen) ? "clinic" : "other";
    const phone = t.phone || t["contact:phone"];
    const address = [t["addr:street"], t["addr:city"], t["addr:suburb"]].filter(Boolean).join(", ") || undefined;
    const tagBlob = JSON.stringify(t).toLowerCase();
    const deliveryRecommended = kind === "hospital" || /obstetric|maternity|birth|delivery/.test(tagBlob);

    out.push({ id: String(el.id), name, kind, lat: elat, lon: elon, distanceKm: haversineKm(lat, lon, elat, elon), phone, address, deliveryRecommended });
  }
  out.sort((x, y) => x.distanceKm - y.distanceKm);
  return out.slice(0, 30);
}
