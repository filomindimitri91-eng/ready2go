import React, { useState, useRef, useEffect } from "react";
import { Loader2, Upload, X, Paperclip, Search } from "lucide-react";
import { Button, Input, Label } from "@/components/ui-elements";
import { cn } from "@/lib/utils";
import { PriceSection } from "@/components/price-section";
import type { EventType } from "@workspace/api-client-react";
import { NavButtons } from "@/components/nav-buttons";

// ─── Static data ─────────────────────────────────────────────────────────────

const LODGING_TYPES = [
  { value: "hotel",      label: "Hôtel",            emoji: "🏨" },
  { value: "airbnb",     label: "Airbnb",            emoji: "🏠" },
  { value: "rental",     label: "Loc. vacances",     emoji: "🏡" },
  { value: "camping",    label: "Camping",            emoji: "⛺" },
  { value: "hostel",     label: "Auberge",            emoji: "🛏️" },
  { value: "guesthouse", label: "Chambre d'hôtes",   emoji: "🏘️" },
  { value: "other",      label: "Autre",              emoji: "🏢" },
];

const BOOKING_PROVIDERS = ["Booking.com", "Expedia", "Hotels.com", "Agoda", "Airbnb", "HRS", "Réservation directe", "Autre"];
const RENTAL_PLATFORMS  = ["Airbnb", "Vrbo", "Abritel", "HomeAway", "Gîtes de France", "Location directe", "Autre"];

// ─── Navigation URL helpers ───────────────────────────────────────────────────
// Priority: GPS coordinates → full address string. Both are mobile-compatible
// (deep-link format opens the native Maps / Waze app on iOS and Android).

export function getMapsUrl(
  address: string,
  city: string,
  country: string,
  lat?: string | number | null,
  lng?: string | number | null,
): string {
  const latStr = String(lat ?? "").trim();
  const lngStr = String(lng ?? "").trim();
  if (latStr && lngStr && !isNaN(Number(latStr)) && !isNaN(Number(lngStr))) {
    // Coordinate-based deep link — opens the native Maps app on mobile
    return `https://maps.google.com/?q=${latStr},${lngStr}`;
  }
  const full = [address, city, country].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
}

export function getWazeUrl(
  address: string,
  city: string,
  country: string,
  lat?: string | number | null,
  lng?: string | number | null,
): string {
  const latStr = String(lat ?? "").trim();
  const lngStr = String(lng ?? "").trim();
  if (latStr && lngStr && !isNaN(Number(latStr)) && !isNaN(Number(lngStr))) {
    // Coordinate-based deep link — opens the native Waze app on mobile
    return `https://waze.com/ul?ll=${latStr},${lngStr}&navigate=yes`;
  }
  const full = [address, city, country].filter(Boolean).join(", ");
  return `https://waze.com/ul?q=${encodeURIComponent(full)}&navigate=yes`;
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">{title}</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, required, optional, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; optional?: boolean; type?: string;
}) {
  return (
    <div>
      <Label>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <Input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function SelectInput({ label, value, onChange, options, placeholder, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string; optional?: boolean;
}) {
  return (
    <div>
      <Label>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <input
        list={`sel-${label.replace(/\s/g, "")}`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? "Choisir ou saisir..."}
        className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all"
      />
      <datalist id={`sel-${label.replace(/\s/g, "")}`}>
        {options.map(o => <option key={o} value={o} />)}
      </datalist>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all",
        checked ? "border-primary bg-primary/5 text-primary" : "border-border bg-background text-muted-foreground"
      )}
    >
      <div className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all", checked ? "border-primary bg-primary" : "border-muted-foreground/40")}>
        {checked && <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
      </div>
      {label}
    </button>
  );
}

function FileUpload({ value, onChange }: { value: { name: string; url: string; size?: number; type?: string } | null; onChange: (v: { name: string; url: string; size: number; type: string } | null) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange({ name: file.name, url: ev.target?.result as string, size: file.size, type: file.type });
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <Label>Confirmation / Bon de réservation <span className="text-muted-foreground font-normal">(opt.)</span></Label>
      {value ? (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border-2 border-primary/20 rounded-xl">
          <Paperclip className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.name}</p>
            {value.size && <p className="text-xs text-muted-foreground">{(value.size / 1024).toFixed(0)} Ko</p>}
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center p-5 bg-muted/40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
          <Upload className="w-5 h-5 text-muted-foreground mb-1.5" />
          <span className="text-sm text-muted-foreground text-center">PDF, image ou capture d'écran</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

function MapsButtons({ address, city, country, lat, lng }: {
  address: string; city: string; country: string;
  lat?: string | null; lng?: string | null;
}) {
  const full = [address, city, country].filter(Boolean).join(", ");
  if (!full.trim()) return null;
  const mapsUrl = getMapsUrl(address, city, country, lat, lng);
  const wazeUrl = getWazeUrl(address, city, country, lat, lng);
  return (
    <div className="flex gap-2 flex-wrap">
      <NavButtons mapsUrl={mapsUrl} wazeUrl={wazeUrl} />
    </div>
  );
}

// ─── OpenStreetMap search ─────────────────────────────────────────────────────

interface OsmRaw {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
    postcode?: string;
  };
  extratags?: Record<string, string>;
}

export interface OsmPlace {
  name: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  lat: string;
  lng: string;
  phone: string;
  email: string;
  website: string;
  brand: string;
}

function parseOsm(r: OsmRaw): OsmPlace {
  const a = r.address ?? {};
  const et = r.extratags ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");

  // Broader city fallback: city → city_district → town → village → municipality → county
  const city = a.city ?? a.city_district ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";

  // Normalise country name via Intl — avoids "France métropolitaine", "España" etc.
  let country = a.country ?? "";
  if (a.country_code) {
    try {
      country =
        new Intl.DisplayNames(["fr"], { type: "region" }).of(
          a.country_code.toUpperCase()
        ) ?? a.country ?? "";
    } catch {
      country = a.country ?? "";
    }
  }

  const name = r.name ?? r.display_name.split(",")[0]?.trim() ?? "";
  return {
    name,
    address: street,
    city,
    country,
    countryCode: a.country_code ?? "",
    lat: r.lat,
    lng: r.lon,
    phone: et["contact:phone"] ?? et["phone"] ?? "",
    email: et["contact:email"] ?? et["email"] ?? "",
    website: et["contact:website"] ?? et["website"] ?? "",
    brand: et["brand"] ?? "",
  };
}

// Country code → flag emoji
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "📍";
  return String.fromCodePoint(
    ...code.toUpperCase().split("").map(c => 0x1F1E0 - 65 + c.charCodeAt(0))
  );
}

const OSM_HINT: Record<string, string> = {
  hotel: "hôtel",
  camping: "camping",
  hostel: "auberge jeunesse",
  guesthouse: "chambre hôtes",
  rental: "location vacances",
  airbnb: "",
  other: "",
};

function LodgingSearchInput({ value, onChange, onSelect, lodgingType }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: OsmPlace) => void;
  lodgingType: string;
}) {
  const [results, setResults] = useState<OsmPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const search = async (q: string) => {
    if (q.trim().length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const hint = OSM_HINT[lodgingType] ?? "";
      const query = hint ? `${q} ${hint}` : q;
      const url =
        `https://nominatim.openstreetmap.org/search` +
        `?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&limit=7&accept-language=fr`;
      const res = await fetch(url, { headers: { "User-Agent": "Ready2Go/1.0" } });
      const data: OsmRaw[] = await res.json();
      const places = data.map(parseOsm).filter(p => p.name);
      setResults(places);
      setOpen(places.length > 0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (v: string) => {
    onChange(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => search(v), 500);
  };

  const handleSelect = (place: OsmPlace) => {
    onChange(place.name);
    onSelect(place);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={box} className="relative">
      <Label>
        Nom de l'hébergement <span className="text-destructive ml-0.5">*</span>
      </Label>
      <div className="relative">
        <input
          type="text"
          required
          value={value}
          onChange={e => handleChange(e.target.value)}
          placeholder="Rechercher ou saisir le nom..."
          className={cn(
            "flex h-12 w-full rounded-xl border-2 bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 transition-all pr-10",
            open ? "border-primary" : "border-border"
          )}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
          {loading
            ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
            : <Search className="w-4 h-4 text-muted-foreground/60" />
          }
        </div>
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-[100] left-0 right-0 mt-1.5 rounded-2xl border-2 border-primary/20 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
          <div className="px-3 py-2 bg-primary/5 border-b border-primary/10">
            <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">
              Résultats OpenStreetMap
            </p>
          </div>
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              {/* Name row */}
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5 shrink-0">
                  {place.countryCode ? countryFlag(place.countryCode) : "🏨"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">
                    {place.name}
                  </div>
                  {/* Address */}
                  {(place.address || place.city) && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {[place.address, place.city].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {/* Country */}
                  {place.country && (
                    <div className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mt-0.5">
                      {place.country}
                    </div>
                  )}
                  {/* Phone / email */}
                  {(place.phone || place.email) && (
                    <div className="text-xs text-primary mt-1 flex flex-wrap gap-3">
                      {place.phone && <span>📞 {place.phone}</span>}
                      {place.email && <span>✉️ {place.email}</span>}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-1">
            <span>©</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-zinc-600 transition-colors"
            >
              OpenStreetMap
            </a>
            <span>contributeurs ODbL</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LodgingSubmitData {
  type: EventType;
  title: string;
  date: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  pricePerPerson: number | null;
  priceType: string | null;
  lodgingData: Record<string, unknown>;
}

interface Props {
  tripDate: string;
  tripStartDate: string;
  tripEndDate: string;
  onSubmit: (data: LodgingSubmitData) => void;
  isPending: boolean;
  onCancel: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const blank = {
  lodgingType: "",
  name: "",
  brand: "",
  address: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  checkInDate: "",
  checkInTime: "",
  checkOutDate: "",
  checkOutTime: "",
  bookingProvider: "",
  bookingReference: "",
  roomType: "",
  guestCount: "",
  phone: "",
  email: "",
  hostName: "",
  accessCode: "",
  accessInstructions: "",
  unit: "",
  contactPerson: "",
  contactPhone: "",
  pitchNumber: "",
  vehiclePlate: "",
  dormType: "",
  bedNumber: "",
  notes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function LodgingForm({ tripDate, tripStartDate, tripEndDate, onSubmit, isPending, onCancel }: Props) {
  const [d, setD] = useState({ ...blank, checkInDate: tripDate });
  const [breakfastIncluded, setBreakfastIncluded] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; url: string; size: number; type: string } | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceType, setPriceType] = useState("per_person");

  const set = (key: keyof typeof blank) => (value: string) => setD(prev => ({ ...prev, [key]: value }));

  // Auto-fill from OpenStreetMap selection — only overwrites empty fields to preserve manual edits
  const handleOsmSelect = (place: OsmPlace) => {
    setD(prev => ({
      ...prev,
      name:      place.name      || prev.name,
      address:   place.address   || prev.address,
      city:      place.city      || prev.city,
      country:   place.country   || prev.country,
      latitude:  place.lat       || prev.latitude,
      longitude: place.lng       || prev.longitude,
      phone:     place.phone     || prev.phone,
      email:     place.email     || prev.email,
      brand:     place.brand     || prev.brand,
    }));
  };

  const lt = d.lodgingType;

  const showBrand          = lt === "hotel";
  const showRoomType       = lt === "hotel" || lt === "hostel";
  const showGuestCount     = ["hotel", "airbnb", "rental", "camping", "hostel"].includes(lt);
  const showBookingProvider = ["hotel", "hostel"].includes(lt);
  const showRentalPlatform  = lt === "rental";
  const showPhone          = lt === "hotel";
  const showEmail          = lt === "hotel";
  const showHostName       = lt === "airbnb" || lt === "guesthouse";
  const showAccessCode     = ["airbnb", "rental"].includes(lt);
  const showUnit           = lt === "airbnb";
  const showAccessInstr    = ["rental", "other"].includes(lt);
  const showContactPerson  = lt === "rental";
  const showPitch          = lt === "camping";
  const showVehiclePlate   = lt === "camping";
  const showDormType       = lt === "hostel";
  const showBedNumber      = lt === "hostel";
  const showBreakfast      = lt === "guesthouse";

  function buildTitle() {
    const emoji = LODGING_TYPES.find(t => t.value === lt)?.emoji ?? "🏠";
    const cityPart = d.city ? ` · ${d.city}` : "";
    return `${emoji} ${d.name}${cityPart}`.trim() || "Logement";
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lt) return;
    const lodgingData: Record<string, unknown> = {
      ...d,
      breakfastIncluded,
      attachmentName: attachment?.name ?? null,
      attachmentUrl: attachment?.url ?? null,
      attachmentSize: attachment?.size ?? null,
      attachmentType: attachment?.type ?? null,
    };
    const price = isFree ? 0 : (priceInput !== "" ? parseFloat(priceInput) : null);
    onSubmit({
      type: "logement" as EventType,
      title: buildTitle(),
      date: d.checkInDate || tripDate,
      location: [d.address, d.city].filter(Boolean).join(", ") || null,
      startTime: d.checkInTime || null,
      endTime: d.checkOutTime || null,
      notes: d.notes || null,
      pricePerPerson: price,
      priceType: price !== null ? priceType : null,
      lodgingData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Lodging type selector */}
      <Section title="Type d'hébergement">
        <div className="grid grid-cols-4 gap-2">
          {LODGING_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setD(prev => ({ ...blank, checkInDate: prev.checkInDate, lodgingType: t.value }))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border-2 transition-all text-center",
                lt === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {!lt && <p className="text-xs text-muted-foreground text-center">Sélectionnez un type d'hébergement pour continuer</p>}
      </Section>

      {lt && (
        <>
          {/* Property info */}
          <Section title="Établissement">
            <LodgingSearchInput
              value={d.name}
              onChange={set("name")}
              onSelect={handleOsmSelect}
              lodgingType={lt}
            />
            {showBrand && (
              <TextInput label="Chaîne / Marque" value={d.brand} onChange={set("brand")} placeholder="Ex: Mercure, Ibis, Accor..." optional />
            )}
            {showHostName && (
              <TextInput label={lt === "guesthouse" ? "Nom de l'hôte" : "Nom de l'hôte Airbnb"} value={d.hostName} onChange={set("hostName")} placeholder="Prénom ou nom de l'hôte" optional={lt === "guesthouse"} required={lt === "airbnb"} />
            )}
            {showRentalPlatform && (
              <SelectInput label="Plateforme de réservation" value={d.bookingProvider} onChange={set("bookingProvider")} options={RENTAL_PLATFORMS} />
            )}
          </Section>

          {/* Address */}
          <Section title="Adresse">
            <TextInput label="Adresse complète" value={d.address} onChange={set("address")} placeholder="Ex: 20 Rue Jean Rey" required />
            <Row2>
              <TextInput label="Ville" value={d.city} onChange={set("city")} placeholder="Ex: Paris" required />
              <TextInput label="Pays" value={d.country} onChange={set("country")} placeholder="Ex: France" required />
            </Row2>
            {/* Maps buttons — appear once address is filled */}
            {(d.address || d.city) && (
              <MapsButtons address={d.address} city={d.city} country={d.country} lat={d.latitude} lng={d.longitude} />
            )}
          </Section>

          {/* Stay dates */}
          <Section title="Séjour">
            <Row2>
              <div>
                <Label>Arrivée</Label>
                <Input type="date" required min={tripStartDate} max={tripEndDate} value={d.checkInDate} onChange={e => set("checkInDate")(e.target.value)} />
              </div>
              <div>
                <Label>Heure d'arrivée</Label>
                <Input type="time" value={d.checkInTime} onChange={e => set("checkInTime")(e.target.value)} />
              </div>
            </Row2>
            <Row2>
              <div>
                <Label>Départ</Label>
                <Input type="date" min={d.checkInDate || tripStartDate} max={tripEndDate} value={d.checkOutDate} onChange={e => set("checkOutDate")(e.target.value)} />
              </div>
              <div>
                <Label>Heure de départ <span className="text-muted-foreground font-normal">(opt.)</span></Label>
                <Input type="time" value={d.checkOutTime} onChange={e => set("checkOutTime")(e.target.value)} />
              </div>
            </Row2>
          </Section>

          {/* Room / accommodation details */}
          {(showRoomType || showGuestCount || showDormType || showBedNumber || showPitch || showVehiclePlate || showUnit || showBreakfast) && (
            <Section title="Détails">
              {showRoomType && (
                <TextInput label={lt === "hostel" ? "Type de dortoir / chambre" : "Type de chambre"} value={d.roomType} onChange={set("roomType")} placeholder="Ex: Chambre double, Dortoir 6 lits..." optional />
              )}
              {showDormType && (
                <TextInput label="Type de lit / dortoir" value={d.dormType} onChange={set("dormType")} placeholder="Ex: Lit en dortoir mixte 8..." optional />
              )}
              {showBedNumber && (
                <TextInput label="Numéro de lit" value={d.bedNumber} onChange={set("bedNumber")} placeholder="Ex: Lit 3" optional />
              )}
              {showGuestCount && (
                <TextInput label="Nombre de voyageurs" value={d.guestCount} onChange={set("guestCount")} placeholder="Ex: 2" type="number" />
              )}
              {showUnit && (
                <TextInput label="Appartement / Étage / Unité" value={d.unit} onChange={set("unit")} placeholder="Ex: Appt 4B, 3ème étage" optional />
              )}
              {showPitch && (
                <TextInput label="Numéro d'emplacement / Bungalow" value={d.pitchNumber} onChange={set("pitchNumber")} placeholder="Ex: Emplacement 42, Bungalow 7..." optional />
              )}
              {showVehiclePlate && (
                <TextInput label="Plaque d'immatriculation" value={d.vehiclePlate} onChange={set("vehiclePlate")} placeholder="Ex: AB-123-CD" optional />
              )}
              {showBreakfast && (
                <Toggle label="Petit-déjeuner inclus" checked={breakfastIncluded} onChange={setBreakfastIncluded} />
              )}
            </Section>
          )}

          {/* Access */}
          {(showAccessCode || showAccessInstr || showContactPerson) && (
            <Section title="Accès">
              {showAccessCode && (
                <TextInput label="Code d'accès / Digicode" value={d.accessCode} onChange={set("accessCode")} placeholder="Ex: 1234A#" optional />
              )}
              {showAccessInstr && (
                <div>
                  <Label>Instructions d'accès <span className="text-muted-foreground font-normal">(opt.)</span></Label>
                  <textarea
                    value={d.accessInstructions}
                    onChange={e => setD(p => ({ ...p, accessInstructions: e.target.value }))}
                    placeholder="Clé sous le paillasson, portail code 1234..."
                    rows={3}
                    className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
                  />
                </div>
              )}
              {showContactPerson && (
                <Row2>
                  <TextInput label="Personne de contact" value={d.contactPerson} onChange={set("contactPerson")} placeholder="Nom du propriétaire" optional />
                  <TextInput label="Téléphone" value={d.contactPhone} onChange={set("contactPhone")} placeholder="Ex: +33 6 12 34 56 78" optional type="tel" />
                </Row2>
              )}
            </Section>
          )}

          {/* Booking */}
          <Section title="Réservation">
            {showBookingProvider && (
              <SelectInput label="Plateforme de réservation" value={d.bookingProvider} onChange={set("bookingProvider")} options={BOOKING_PROVIDERS} optional />
            )}
            <TextInput
              label={lt === "airbnb" ? "Code de confirmation Airbnb" : "Référence de réservation"}
              value={d.bookingReference}
              onChange={set("bookingReference")}
              placeholder="Ex: BK-123456"
              optional
            />
            {showPhone && (
              <Row2>
                <TextInput label="Téléphone de l'hôtel" value={d.phone} onChange={set("phone")} placeholder="Ex: +33 1 23 45 67 89" optional type="tel" />
                <TextInput label="Email de l'hôtel" value={d.email} onChange={set("email")} placeholder="hotel@exemple.com" optional type="email" />
              </Row2>
            )}
            <FileUpload value={attachment} onChange={setAttachment} />
          </Section>

          {/* Prix */}
          <Section title="Prix">
            <PriceSection
              priceInput={priceInput}
              onPriceChange={setPriceInput}
              isFree={isFree}
              onFreeToggle={() => { setIsFree(v => !v); if (!isFree) setPriceInput(""); }}
              priceType={priceType}
              onPriceTypeChange={setPriceType}
            />
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <div>
              <Label>Notes <span className="text-muted-foreground font-normal">(opt.)</span></Label>
              <textarea
                value={d.notes}
                onChange={e => setD(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Arrivée tardive possible, demander chambre calme..."
                rows={3}
                className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
              />
            </div>
          </Section>
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={isPending || !lt}>
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
