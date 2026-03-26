import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Event } from "@workspace/api-client-react";
import { RefreshCw, Play } from "lucide-react";

// ─── Fix leaflet marker icon path (bundler issue) ─────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Emoji maps ───────────────────────────────────────────────────────────────
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

// ─── POI click data (exported for parent) ─────────────────────────────────────
export interface PoiClickData {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  emoji: string;
  tags: Record<string, string>;
}

// ─── Tour step ────────────────────────────────────────────────────────────────
interface TourStep {
  coords: [number, number];
  zoom: number;
  label: string;
  eventId?: string;
}

// ─── Geocoding cache ──────────────────────────────────────────────────────────
const geoCache = new Map<string, [number, number] | null>();

function buildQueryVariants(raw: string): string[] {
  const variants: string[] = [raw];
  const noParen = raw.replace(/\s*\([^)]*\)/g, "").trim();
  if (noParen && noParen !== raw) variants.push(noParen);
  const noDash = noParen.replace(/\s*[-–]\s*/g, " ").trim();
  if (noDash && noDash !== noParen) variants.push(noDash);
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
  for (const v of buildQueryVariants(query)) {
    const result = await geocodeOne(v);
    if (result) { geoCache.set(query, result); return result; }
  }
  geoCache.set(query, null);
  return null;
}

// ─── Emoji marker icons ───────────────────────────────────────────────────────
function emojiIcon(emoji: string, bg: string = "#1d4ed8", pulse = false) {
  return L.divIcon({
    className: "",
    html: `
      <div style="
        display:flex;align-items:center;justify-content:center;
        width:38px;height:38px;
        background:${bg};
        border:3px solid #fff;
        border-radius:50%;
        box-shadow:0 2px 10px rgba(0,0,0,0.4);
        font-size:17px;line-height:1;cursor:pointer;
        ${pulse ? "animation:r2g-pulse 1.5s ease-in-out infinite;" : ""}
      ">${emoji}</div>
      <div style="
        width:0;height:0;
        border-left:6px solid transparent;
        border-right:6px solid transparent;
        border-top:9px solid ${bg};
        margin:-2px auto 0;width:12px;
      "></div>`,
    iconSize: [38, 48],
    iconAnchor: [19, 48],
    popupAnchor: [0, -50],
  });
}

function poiIcon(emoji: string, highlighted = false) {
  return L.divIcon({
    className: "",
    html: `<div style="
      font-size:${highlighted ? "24px" : "20px"};
      filter:drop-shadow(0 1px 4px rgba(0,0,0,0.55));
      line-height:1;
      cursor:pointer;
      ${highlighted ? "animation:r2g-bounce 0.8s ease-in-out infinite;" : ""}
    ">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

// ─── Event helpers ────────────────────────────────────────────────────────────
function getEventEmoji(event: Event): { emoji: string; bg: string } {
  const d = event as any;
  switch (event.type) {
    case "transport": return { emoji: TRANSPORT_EMOJI[d.transportData?.transportType ?? "other"] ?? "🔄", bg: "#1d4ed8" };
    case "logement":  return { emoji: LODGING_EMOJI[d.lodgingData?.lodgingType ?? "other"] ?? "🏨", bg: "#7c3aed" };
    case "restauration":
    case "reunion":   return { emoji: RESTO_EMOJI[d.restaurationData?.restoType ?? "autre"] ?? "🍽️", bg: "#ea580c" };
    case "activite":  return { emoji: ACTIVITE_EMOJI[d.activiteData?.activiteType ?? "autre"] ?? "📍", bg: "#d97706" };
    default:          return { emoji: "📌", bg: "#64748b" };
  }
}

function extractKnownCoords(event: Event): [number, number] | null {
  const d = event as any;
  const ok = (la: any, lo: any): [number, number] | null => {
    const a = Number(la), o = Number(lo);
    return (!isNaN(a) && !isNaN(o) && (a !== 0 || o !== 0)) ? [a, o] : null;
  };
  if (event.type === "logement")   return ok(d.lodgingData?.latitude, d.lodgingData?.longitude);
  if (event.type === "restauration" || event.type === "reunion") return ok(d.restaurationData?.latitude, d.restaurationData?.longitude);
  if (event.type === "activite")   return ok(d.activiteData?.latitude, d.activiteData?.longitude);
  return null;
}

function buildGeoQuery(event: Event): string | null {
  const d = event as any;
  if (event.type === "logement") {
    const ld = d.lodgingData;
    return [ld?.address, ld?.city, ld?.country].filter(Boolean).join(", ") || null;
  }
  if (event.type === "restauration" || event.type === "reunion") {
    const rd = d.restaurationData;
    return [rd?.name, rd?.address, rd?.city, rd?.country].filter(Boolean).join(", ") || null;
  }
  if (event.type === "activite") {
    const ad = d.activiteData;
    return [ad?.name, ad?.city, ad?.country].filter(Boolean).join(", ") || ad?.city || null;
  }
  return event.location;
}

// ─── Overpass POIs ─────────────────────────────────────────────────────────────
export interface PoiItem {
  lat: number; lon: number; name: string; emoji: string;
  tags: Record<string, string>;
}

async function fetchPOIs(lat: number, lon: number): Promise<PoiItem[]> {
  const radius = 5000;
  const queries = [
    `node["tourism"="attraction"]`,
    `node["tourism"="museum"]`,
    `node["historic"="church"]`,
    `node["historic"="castle"]`,
    `node["tourism"="viewpoint"]`,
  ].map(q => `${q}(around:${radius},${lat},${lon});`).join("\n");
  const query = `[out:json][timeout:10];(\n${queries}\n);out 15;`;
  try {
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const data = await res.json();
    const items: PoiItem[] = [];
    for (const el of (data.elements ?? []).slice(0, 15)) {
      const tags: Record<string, string> = el.tags ?? {};
      const name = tags.name || tags["name:fr"] || "Point d'intérêt";
      const emoji = tags.tourism === "museum" ? "🖼️"
        : tags.tourism === "viewpoint" ? "🌅"
        : tags.historic === "castle" ? "🏰"
        : tags.historic === "church" ? "⛪"
        : "🏛️";
      items.push({ lat: el.lat, lon: el.lon, name, emoji, tags });
    }
    return items;
  } catch { return []; }
}

// ─── Animated CSS ──────────────────────────────────────────────────────────────
const ANIM_STYLE = `
.animated-route {
  stroke-dasharray: 14 8;
  animation: dash-flow 1.8s linear infinite;
}
@keyframes dash-flow { to { stroke-dashoffset: -22; } }
@keyframes r2g-pulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.6), 0 2px 10px rgba(0,0,0,0.4); }
  50%      { box-shadow: 0 0 0 8px rgba(255,255,255,0),  0 2px 10px rgba(0,0,0,0.4); }
}
@keyframes r2g-bounce {
  0%,100% { transform: translateY(0); }
  50%      { transform: translateY(-4px); }
}
`;

export interface MemberLocation {
  userId: number;
  username: string;
  lat: number;
  lng: number;
}

// ─── Component ────────────────────────────────────────────────────────────────
interface TripMapProps {
  events: Event[];
  destination: string;
  isAddingEvent?: boolean;
  mapSelectMode?: boolean;
  activeEventType?: string;
  focusedEventId?: string | null;
  onPoiClick?: (poi: PoiClickData) => void;
  memberLocations?: MemberLocation[];
  myUserId?: number;
}

const MEMBER_COLORS = ["#3b82f6","#8b5cf6","#f59e0b","#10b981","#ef4444","#06b6d4","#f97316"];

function memberMarkerIcon(username: string, colorIdx: number, isMe: boolean): L.DivIcon {
  const color = MEMBER_COLORS[colorIdx % MEMBER_COLORS.length];
  const initial = username.charAt(0).toUpperCase();
  return L.divIcon({
    className: "",
    html: `<div style="
      width:32px;height:32px;border-radius:50%;
      background:${color};border:3px solid ${isMe ? "#fff" : "rgba(255,255,255,0.8)"};
      display:flex;align-items:center;justify-content:center;
      color:#fff;font-weight:700;font-size:13px;font-family:sans-serif;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      ${isMe ? "outline:3px solid " + color + "88;" : ""}
    ">${initial}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

export function TripMap({
  events,
  destination,
  isAddingEvent = false,
  mapSelectMode = false,
  activeEventType,
  focusedEventId,
  onPoiClick,
  memberLocations = [],
  myUserId,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const memberMarkersRef = useRef<Map<number, L.Marker>>(new Map());

  // Tour state
  const tourStepsRef      = useRef<TourStep[]>([]);
  const eventCoordsRef    = useRef<Map<string, [number, number]>>(new Map());
  const tourTimerRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tourActiveRef     = useRef(false);
  const tourIndexRef      = useRef(0);
  const mapReadyRef       = useRef(false);
  const advanceFnRef      = useRef<() => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [tourPaused, setTourPaused] = useState(false);
  // Track programmatic flyTo so we don't pause the tour on its own zoomstart
  const isProgrammaticRef = useRef(false);
  // Mutable refs for props — so POI click handlers can read current values without re-creating markers
  const isAddingEventRef   = useRef(isAddingEvent);
  const mapSelectModeRef   = useRef(mapSelectMode);
  const activeEventTypeRef = useRef(activeEventType);
  const onPoiClickRef      = useRef(onPoiClick);

  // ─── Tour control functions ──────────────────────────────────────────────
  const stopTour = () => {
    tourActiveRef.current = false;
    if (tourTimerRef.current) { clearTimeout(tourTimerRef.current); tourTimerRef.current = null; }
    setTourPaused(true);
  };

  const startTour = (fromIndex = 0) => {
    if (!mapReadyRef.current || tourStepsRef.current.length === 0) return;
    tourActiveRef.current = true;
    tourIndexRef.current = fromIndex;
    setTourPaused(false);
    if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
    advanceFnRef.current();
  };

  // Keep prop refs in sync
  useEffect(() => { isAddingEventRef.current   = isAddingEvent;   }, [isAddingEvent]);
  useEffect(() => { mapSelectModeRef.current   = mapSelectMode;   }, [mapSelectMode]);
  useEffect(() => { activeEventTypeRef.current = activeEventType; }, [activeEventType]);
  useEffect(() => { onPoiClickRef.current      = onPoiClick;      }, [onPoiClick]);

  // ─── Member location markers ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const existing = memberMarkersRef.current;
    const currentIds = new Set(memberLocations.map(l => l.userId));

    // Remove stale markers
    for (const [uid, marker] of existing.entries()) {
      if (!currentIds.has(uid)) {
        marker.remove();
        existing.delete(uid);
      }
    }

    // Add / update markers
    memberLocations.forEach((loc, idx) => {
      const isMe = loc.userId === myUserId;
      const icon = memberMarkerIcon(loc.username, idx, isMe);
      const tooltip = `${loc.username}${isMe ? " (moi)" : ""}`;

      const existing_marker = existing.get(loc.userId);
      if (existing_marker) {
        existing_marker.setLatLng([loc.lat, loc.lng]);
        existing_marker.setIcon(icon);
      } else {
        const marker = L.marker([loc.lat, loc.lng], { icon, zIndexOffset: 1000 })
          .bindTooltip(tooltip, { permanent: false, direction: "top", offset: [0, -16] })
          .addTo(map);
        existing.set(loc.userId, marker);
      }
    });
  }, [memberLocations, myUserId]);

  // ─── Map initialization ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!document.getElementById("r2g-map-style")) {
      const s = document.createElement("style");
      s.id = "r2g-map-style";
      s.textContent = ANIM_STYLE;
      document.head.appendChild(s);
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

    // Pause tour only on user-initiated interaction (not programmatic flyTo)
    map.on("dragstart zoomstart", () => {
      if (tourActiveRef.current && !isProgrammaticRef.current) stopTour();
    });

    const allMarkerCoords: [number, number][] = [];
    const tourSteps: TourStep[] = [];
    const eventCoords = new Map<string, [number, number]>();
    const poiMarkersRef: L.Marker[] = [];

    (async () => {
      const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

      // 1. Geocode destination
      const destCity = destination.split(",")[0].trim();
      const destCoords = await geocode(destCity);

      // 2. Process events in chronological order
      const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));

      for (const event of sorted) {
        const { emoji, bg } = getEventEmoji(event);

        if (event.type === "transport") {
          const td = (event as any).transportData ?? {};
          if (td.departureLocation && td.arrivalLocation) {
            await sleep(300);
            const from = await geocode(td.departureLocation);
            await sleep(300);
            const to   = await geocode(td.arrivalLocation);

            if (from) {
              allMarkerCoords.push(from);
              eventCoords.set(event.id, from);
              tourSteps.push({ coords: from, zoom: 11, label: `Départ — ${td.departureLocation}`, eventId: event.id });
              L.marker(from, { icon: emojiIcon(emoji, bg) })
                .bindPopup(`<b>${emoji} ${event.title}</b><br>Départ : ${td.departureLocation}`)
                .addTo(map);
            }
            if (to) {
              allMarkerCoords.push(to);
              tourSteps.push({ coords: to, zoom: 11, label: `Arrivée — ${td.arrivalLocation}`, eventId: event.id });
              L.marker(to, { icon: emojiIcon("🎯", "#16a34a") })
                .bindPopup(`<b>Arrivée</b><br>${td.arrivalLocation}`)
                .addTo(map);
            }
            if (from && to) {
              const pts = interpolateGreatCircle(from, to, 12);
              L.polyline(pts, { color: "#2563eb", weight: 3, opacity: 0.85, className: "animated-route" }).addTo(map);
            }
          }
          continue;
        }

        let coords = extractKnownCoords(event);
        if (!coords) {
          const q = buildGeoQuery(event);
          if (q) { await sleep(300); coords = await geocode(q); }
        }

        if (coords) {
          allMarkerCoords.push(coords);
          eventCoords.set(event.id, coords);
          const zoomLvl = (event.type === "logement" || event.type === "restauration" || event.type === "activite") ? 15 : 13;
          tourSteps.push({ coords, zoom: zoomLvl, label: event.title, eventId: event.id });
          const label = (event.title || "").replace(/^[^\s]+\s/, "");
          L.marker(coords, { icon: emojiIcon(emoji, bg) })
            .bindPopup(`<b>${emoji} ${label}</b>${event.location ? `<br>${event.location}` : ""}`)
            .addTo(map);
        }
      }

      // 3. Fetch POIs
      const center = destCoords ?? allMarkerCoords[0] ?? null;
      if (center) {
        const pois = await fetchPOIs(center[0], center[1]);

        // Add destination to tour if no events
        if (tourSteps.length === 0) {
          tourSteps.push({ coords: center, zoom: 13, label: destCity });
          allMarkerCoords.push(center);
          // Add POI waypoints for cinematic tour
          for (const p of pois.slice(0, 5)) {
            tourSteps.push({ coords: [p.lat, p.lon], zoom: 15, label: p.name });
          }
        }

        for (const poi of pois) {
          const marker = L.marker([poi.lat, poi.lon], {
            icon: poiIcon(poi.emoji),
            opacity: 0.85,
          });

          // Always bind popup for browse mode
          marker.bindPopup(`<b>${poi.emoji} ${poi.name}</b><br><i>Point d'intérêt</i>`);

          // Dynamic click handler: reads current refs at click time
          marker.on("click", (e) => {
            if ((isAddingEventRef.current || mapSelectModeRef.current) && onPoiClickRef.current) {
              L.DomEvent.stopPropagation(e);
              onPoiClickRef.current({
                name: poi.name,
                lat: poi.lat,
                lon: poi.lon,
                emoji: poi.emoji,
                tags: poi.tags,
              });
            }
            // else: Leaflet opens the popup automatically via bindPopup
          });

          marker.addTo(map);
          poiMarkersRef.push(marker);
        }
      }

      // 4. Fit bounds
      if (allMarkerCoords.length > 0) {
        map.fitBounds(L.latLngBounds(allMarkerCoords.map(c => L.latLng(c[0], c[1]))), {
          padding: [36, 36], maxZoom: 14,
        });
      } else {
        map.setView([46.5, 2.3], 5);
      }

      // 5. Store tour data and start
      tourStepsRef.current = tourSteps;
      eventCoordsRef.current = eventCoords;
      mapReadyRef.current = true;

      // Define advance function (closure over `map`)
      advanceFnRef.current = () => {
        if (!tourActiveRef.current || !mapRef.current) return;
        const steps = tourStepsRef.current;
        if (steps.length === 0) return;
        const idx = tourIndexRef.current % steps.length;
        const step = steps[idx];
        // Mark as programmatic so zoomstart/dragstart don't pause the tour
        isProgrammaticRef.current = true;
        mapRef.current.once("moveend", () => { isProgrammaticRef.current = false; });
        mapRef.current.flyTo(step.coords, step.zoom, { duration: 2.2, easeLinearity: 0.3 });
        tourIndexRef.current = (idx + 1) % steps.length;
        tourTimerRef.current = setTimeout(advanceFnRef.current, 4500);
      };

      setLoading(false);

      // Auto-start tour after a brief pause
      if (tourSteps.length >= 2) {
        tourTimerRef.current = setTimeout(() => {
          tourActiveRef.current = true;
          setTourPaused(false);
          advanceFnRef.current();
        }, 2000);
      }
    })();

    return () => {
      tourActiveRef.current = false;
      if (tourTimerRef.current) clearTimeout(tourTimerRef.current);
      mapReadyRef.current = false;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── React to focusedEventId changes ─────────────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return;
    if (focusedEventId) {
      const coords = eventCoordsRef.current.get(focusedEventId);
      if (coords) {
        stopTour();
        isProgrammaticRef.current = true;
        mapRef.current.once("moveend", () => { isProgrammaticRef.current = false; });
        mapRef.current.flyTo(coords, 14, { duration: 1.5, easeLinearity: 0.4 });
      }
    } else {
      // Unfocused → restart tour
      if (!tourActiveRef.current && mapReadyRef.current) {
        startTour(tourIndexRef.current);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedEventId]);

  return (
    <div className="relative isolate rounded-2xl overflow-hidden shadow-lg" style={{ height: 280 }}>
      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-primary/30 backdrop-blur-sm rounded-2xl">
          <div className="flex items-center gap-2 text-white text-sm font-medium bg-black/30 px-4 py-2 rounded-full">
            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="60" strokeDashoffset="20" />
            </svg>
            Chargement de la carte…
          </div>
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Map select mode — full interactive hint */}
      {!loading && mapSelectMode && (
        <div className="absolute inset-0 z-10 pointer-events-none">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-bold px-4 py-2 rounded-full shadow-xl animate-pulse">
            👆 Touchez un point d'intérêt pour le sélectionner
          </div>
          <div className="absolute inset-0 ring-4 ring-primary/40 rounded-2xl" />
        </div>
      )}

      {/* Adding-event hint banner (modal still open) */}
      {!loading && isAddingEvent && !mapSelectMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-primary/90 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg pointer-events-none">
          Ouvrez le formulaire puis "Choisir sur la carte"
        </div>
      )}

      {/* Relancer le scénario button */}
      {!loading && tourPaused && !isAddingEvent && (
        <button
          onClick={() => startTour(tourIndexRef.current)}
          className="absolute bottom-8 right-2 z-20 flex items-center gap-1.5 bg-white/90 hover:bg-white text-primary text-xs font-semibold px-3 py-1.5 rounded-full shadow-md border border-white/50 transition-all hover:shadow-lg"
          title="Relancer le scénario de la carte"
        >
          <Play className="w-3 h-3 fill-current" />
          Relancer
        </button>
      )}
    </div>
  );
}

// ─── Great-circle interpolation ───────────────────────────────────────────────
function interpolateGreatCircle(from: [number, number], to: [number, number], steps: number): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const [lat1, lon1] = from.map(toRad);
  const [lat2, lon2] = to.map(toRad);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
  ));
  if (d === 0) return [from, to];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}
