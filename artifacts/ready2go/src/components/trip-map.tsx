import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Event } from "@workspace/api-client-react";

// ─── Fix leaflet marker icon path (bundler issue) ─────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Transport type emoji map ─────────────────────────────────────────────────
const TRANSPORT_EMOJI: Record<string, string> = {
  plane: "✈️", train: "🚄", bus: "🚌", ferry: "⛴️",
  metro: "🚇", carRental: "🚗", taxi: "🚕", other: "🔄",
};
const LODGING_EMOJI: Record<string, string> = {
  hotel: "🏨", airbnb: "🏠", rental: "🏡", camping: "⛺",
  hostel: "🛏️", guesthouse: "🏘️", other: "🏢",
};
const RESTO_EMOJI: Record<string, string> = {
  restaurant: "🍽️", fastfood: "🍔", streetfood: "🥙", cafe: "☕",
  pizzeria: "🍕", asian: "🍣", bar: "🍺", autre: "🥗",
};
const ACTIVITE_EMOJI: Record<string, string> = {
  monument: "🏛️", musee: "🖼️", match: "🏟️", concert: "🎵",
  visite: "🗺️", randonnee: "🥾", soiree: "🎉", exposition: "🎨",
  parc: "🎡", autre: "📍",
};

// ─── Geocoding cache ──────────────────────────────────────────────────────────
const geoCache = new Map<string, [number, number] | null>();

/** Simplify a location string for Nominatim:
 *  "Paris - Charles de Gaulle (CDG)" → try full, then "Paris Charles de Gaulle", then "Paris"
 *  "Barcelona - El Prat (BCN)"        → try full, then "Barcelona El Prat", then "Barcelona" */
function buildQueryVariants(raw: string): string[] {
  const variants: string[] = [raw];
  // Remove content in parentheses: "Paris (CDG)" → "Paris"
  const noParen = raw.replace(/\s*\([^)]*\)/g, "").trim();
  if (noParen && noParen !== raw) variants.push(noParen);
  // Replace dashes with spaces: "Paris - Charles" → "Paris Charles"
  const noDash = noParen.replace(/\s*[-–]\s*/g, " ").trim();
  if (noDash && noDash !== noParen) variants.push(noDash);
  // First word only (city): "Paris Charles de Gaulle" → "Paris"
  const firstWord = noDash.split(/\s+/)[0];
  if (firstWord && firstWord !== noDash) variants.push(firstWord);
  return [...new Set(variants)];
}

async function geocodeOne(query: string): Promise<[number, number] | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&accept-language=fr`;
    const res = await fetch(url, { headers: { "User-Agent": "Ready2Go/1.0" } });
    const data = await res.json();
    if (data?.[0]) return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
  } catch { /* ignore */ }
  return null;
}

async function geocode(query: string): Promise<[number, number] | null> {
  if (!query.trim()) return null;
  if (geoCache.has(query)) return geoCache.get(query)!;
  const variants = buildQueryVariants(query);
  for (const v of variants) {
    const result = await geocodeOne(v);
    if (result) {
      geoCache.set(query, result);
      return result;
    }
  }
  geoCache.set(query, null);
  return null;
}

// ─── Create custom emoji marker ───────────────────────────────────────────────
function emojiIcon(emoji: string, color: string = "#fff", bg: string = "#1d4ed8") {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:36px;height:36px;
        background:${bg};
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        font-size:16px;
        line-height:1;
        cursor:pointer;
      ">${emoji}</div>
      <div style="
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:8px solid ${bg};
        margin:-1px auto 0;
        width:12px;
      "></div>
    `,
    iconSize: [36, 46],
    iconAnchor: [18, 46],
    popupAnchor: [0, -46],
  });
}

function poiIcon(emoji: string) {
  return L.divIcon({
    className: "",
    html: `<div style="font-size:20px;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));line-height:1;">${emoji}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
}

// ─── Event color/emoji extraction ────────────────────────────────────────────
function getEventEmoji(event: Event): { emoji: string; bg: string } {
  const d = event as any;
  switch (event.type) {
    case "transport": {
      const tt = d.transportData?.transportType ?? "other";
      return { emoji: TRANSPORT_EMOJI[tt] ?? "🔄", bg: "#1d4ed8" };
    }
    case "logement": {
      const lt = d.lodgingData?.lodgingType ?? "other";
      return { emoji: LODGING_EMOJI[lt] ?? "🏨", bg: "#7c3aed" };
    }
    case "restauration":
    case "reunion": {
      const rt = d.restaurationData?.restoType ?? "autre";
      return { emoji: RESTO_EMOJI[rt] ?? "🍽️", bg: "#ea580c" };
    }
    case "activite": {
      const at = d.activiteData?.activiteType ?? "autre";
      return { emoji: ACTIVITE_EMOJI[at] ?? "📍", bg: "#d97706" };
    }
    default:
      return { emoji: "📌", bg: "#64748b" };
  }
}

// ─── Extract known coords from event data ─────────────────────────────────────
function extractKnownCoords(event: Event): [number, number] | null {
  const d = event as any;
  const tryCoords = (lat: any, lng: any): [number, number] | null => {
    const la = Number(lat), lo = Number(lng);
    if (!isNaN(la) && !isNaN(lo) && (la !== 0 || lo !== 0)) return [la, lo];
    return null;
  };
  if (event.type === "logement")
    return tryCoords(d.lodgingData?.latitude, d.lodgingData?.longitude);
  if (event.type === "restauration" || event.type === "reunion")
    return tryCoords(d.restaurationData?.latitude, d.restaurationData?.longitude);
  if (event.type === "activite")
    return tryCoords(d.activiteData?.latitude, d.activiteData?.longitude);
  return null;
}

// ─── Build geocoding query for event ─────────────────────────────────────────
function buildGeoQuery(event: Event): string | null {
  const d = event as any;
  if (event.type === "logement") {
    const ld = d.lodgingData;
    return [ld?.address, ld?.city, ld?.country].filter(Boolean).join(", ") || null;
  }
  if (event.type === "restauration" || event.type === "reunion") {
    const rd = d.restaurationData;
    return [rd?.address, rd?.city, rd?.country].filter(Boolean).join(", ") || null;
  }
  if (event.type === "activite") {
    const ad = d.activiteData;
    return [ad?.name, ad?.city, ad?.country].filter(Boolean).join(", ") || ad?.city || null;
  }
  return event.location;
}

// ─── Overpass: fetch tourist attractions near center ─────────────────────────
const POI_TYPE_EMOJI: Array<{ emoji: string; label: string; query: string }> = [
  { emoji: "🏛️", label: "Monument",   query: `node["tourism"="attraction"]` },
  { emoji: "🖼️", label: "Musée",     query: `node["tourism"="museum"]` },
  { emoji: "⛪", label: "Église",    query: `node["historic"="church"]` },
  { emoji: "🏰", label: "Château",   query: `node["historic"="castle"]` },
  { emoji: "🌅", label: "Point de vue", query: `node["tourism"="viewpoint"]` },
];

async function fetchPOIs(lat: number, lon: number): Promise<Array<{ lat: number; lon: number; name: string; emoji: string }>> {
  const radius = 5000;
  const types = POI_TYPE_EMOJI.map(t => `${t.query}(around:${radius},${lat},${lon});`).join("\n");
  const query = `[out:json][timeout:10];(\n${types}\n);out 15;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();
    const items: Array<{ lat: number; lon: number; name: string; emoji: string }> = [];
    for (const el of (data.elements ?? []).slice(0, 15)) {
      const name = el.tags?.name || el.tags?.["name:fr"] || "Point d'intérêt";
      const emoji = el.tags?.tourism === "museum" ? "🖼️"
        : el.tags?.tourism === "viewpoint" ? "🌅"
        : el.tags?.historic === "castle" ? "🏰"
        : el.tags?.historic === "church" ? "⛪"
        : "🏛️";
      items.push({ lat: el.lat, lon: el.lon, name, emoji });
    }
    return items;
  } catch { return []; }
}

// ─── Animated dashed polyline CSS ─────────────────────────────────────────────
const ANIM_STYLE = `
.animated-route {
  stroke-dasharray: 14 8;
  animation: dash-flow 1.8s linear infinite;
}
@keyframes dash-flow {
  to { stroke-dashoffset: -22; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────

interface TripMapProps {
  events: Event[];
  destination: string;
}

export function TripMap({ events, destination }: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Inject animation CSS once
    if (!document.getElementById("r2g-map-style")) {
      const style = document.createElement("style");
      style.id = "r2g-map-style";
      style.textContent = ANIM_STYLE;
      document.head.appendChild(style);
    }

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    });
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '© <a href="https://openstreetmap.org/copyright">OSM</a>',
      maxZoom: 19,
    }).addTo(map);

    const allMarkerCoords: [number, number][] = [];

    (async () => {
      // 1. Geocode destination for POIs
      const destCoords = await geocode(destination.split(",")[0].trim());

      // 2. Process events
      const sortedEvents = [...events].sort((a, b) => a.date.localeCompare(b.date));
      const transportPoints: Array<{ from: [number, number]; to: [number, number]; emoji: string; label: string }> = [];

      // Delay between Nominatim requests to respect rate limit
      let delay = 0;
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

      for (const event of sortedEvents) {
        const { emoji, bg } = getEventEmoji(event);

        if (event.type === "transport") {
          const td = (event as any).transportData ?? {};
          const depQuery = td.departureLocation;
          const arrQuery = td.arrivalLocation;

          if (depQuery && arrQuery) {
            await sleep(delay); delay += 300;
            const from = await geocode(depQuery);
            await sleep(delay); delay += 300;
            const to = await geocode(arrQuery);

            if (from && to) {
              transportPoints.push({ from, to, emoji, label: `${td.departureLocation} → ${td.arrivalLocation}` });
              allMarkerCoords.push(from, to);

              // Departure marker
              const depIcon = emojiIcon(emoji, "#fff", bg);
              L.marker(from, { icon: depIcon })
                .bindPopup(`<b>${emoji} ${event.title}</b><br>Départ: ${td.departureLocation}`)
                .addTo(map);

              // Arrival marker (slightly different)
              const arrIcon = emojiIcon("🎯", "#fff", "#16a34a");
              L.marker(to, { icon: arrIcon })
                .bindPopup(`<b>Arrivée</b><br>${td.arrivalLocation}`)
                .addTo(map);
            }
          }
          continue;
        }

        // Non-transport events: use known coords or geocode
        let coords = extractKnownCoords(event);
        if (!coords) {
          const q = buildGeoQuery(event);
          if (q) {
            await sleep(delay); delay += 300;
            coords = await geocode(q);
          }
        }

        if (coords) {
          allMarkerCoords.push(coords);
          const icon = emojiIcon(emoji, "#fff", bg);
          const popupTitle = event.title.replace(/^[^\s]+\s/, "");
          L.marker(coords, { icon })
            .bindPopup(`<b>${emoji} ${popupTitle}</b>${event.location ? `<br>${event.location}` : ""}`)
            .addTo(map);
        }
      }

      // 3. Draw animated transport routes
      for (const route of transportPoints) {
        // Curved great-circle approximation using intermediate points
        const pts = interpolateGreatCircle(route.from, route.to, 12);
        L.polyline(pts, {
          color: "#2563eb",
          weight: 3,
          opacity: 0.85,
          className: "animated-route",
        }).addTo(map);
      }

      // 4. Fetch POIs around destination
      const center = destCoords ?? allMarkerCoords[0] ?? null;
      if (center) {
        const pois = await fetchPOIs(center[0], center[1]);
        for (const poi of pois) {
          L.marker([poi.lat, poi.lon], { icon: poiIcon(poi.emoji), opacity: 0.75 })
            .bindPopup(`<b>${poi.emoji} ${poi.name}</b><br><i>Point d'intérêt</i>`)
            .addTo(map);
        }
        if (allMarkerCoords.length === 0) allMarkerCoords.push(center);
      }

      // 5. Fit map bounds
      if (allMarkerCoords.length > 0) {
        const bounds = L.latLngBounds(allMarkerCoords.map(c => L.latLng(c[0], c[1])));
        map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
      } else {
        map.setView([46.5, 2.3], 5); // France
      }

      setLoading(false);
    })();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height: 260 }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/20 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-2 text-white text-sm font-medium">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
            Chargement de la carte…
          </div>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}

// ─── Great-circle interpolation (curved route) ────────────────────────────────
function interpolateGreatCircle(from: [number, number], to: [number, number], steps: number): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
  if (d === 0) return [from, to];
  const points: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    points.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return points;
}
