import React, { useState, useRef, useEffect } from "react";
import { Loader2, Search, Upload, X, Paperclip } from "lucide-react";
import { Button, Input, Label } from "@/components/ui-elements";
import { cn } from "@/lib/utils";
import type { EventType } from "@workspace/api-client-react";
import { getMapsUrl, getWazeUrl } from "./lodging-form";
import { NavButtons } from "@/components/nav-buttons";

// ─── Subtypes ─────────────────────────────────────────────────────────────────

const ACTIVITE_TYPES = [
  { value: "monument",    label: "Monument",    emoji: "🏛️" },
  { value: "musee",       label: "Musée",       emoji: "🖼️" },
  { value: "match",       label: "Match",       emoji: "🏟️" },
  { value: "concert",     label: "Concert",     emoji: "🎵" },
  { value: "visite",      label: "Visite",      emoji: "🗺️" },
  { value: "randonnee",   label: "Randonnée",   emoji: "🥾" },
  { value: "soiree",      label: "Soirée",      emoji: "🎉" },
  { value: "exposition",  label: "Exposition",  emoji: "🎨" },
  { value: "parc",        label: "Parc / Loisirs", emoji: "🎡" },
  { value: "autre",       label: "Autre",       emoji: "📍" },
];

export const ACTIVITE_EMOJI: Record<string, string> = Object.fromEntries(ACTIVITE_TYPES.map(t => [t.value, t.emoji]));
export const ACTIVITE_LABEL: Record<string, string> = Object.fromEntries(ACTIVITE_TYPES.map(t => [t.value, t.label]));

// OSM search keywords per subtype
const OSM_HINT: Record<string, string> = {
  monument:   "monument",
  musee:      "musée museum",
  match:      "stade stadium",
  concert:    "salle concert music venue",
  visite:     "attraction touristique",
  randonnee:  "randonnée sentier nature",
  soiree:     "discothèque nightclub boîte de nuit",
  exposition: "galerie exposition",
  parc:       "parc loisirs",
  autre:      "",
};

// ─── OSM types ────────────────────────────────────────────────────────────────

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
    country?: string;
    country_code?: string;
    postcode?: string;
  };
  extratags?: Record<string, string>;
}

export interface ActivityPlace {
  placeId: number;
  name: string;
  address: string;
  city: string;
  country: string;
  lat: string;
  lon: string;
  displayName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countryFlag(code?: string): string {
  if (!code || code.length !== 2) return "";
  return [...code.toUpperCase()].map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))).join("");
}

function normalizeCountry(raw?: string, code?: string): string {
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    if (code?.length === 2) {
      const n = dn.of(code.toUpperCase());
      if (n) return n;
    }
  } catch { /* fallback */ }
  return raw ?? "";
}

function extractAddress(a: OsmRaw["address"]): { address: string; city: string; country: string } {
  if (!a) return { address: "", city: "", country: "" };
  const road = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
  const country = normalizeCountry(a.country, a.country_code);
  return { address: road, city, country };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      <Label className="mb-1">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
        {optional && <span className="text-muted-foreground text-xs ml-1">(facultatif)</span>}
      </Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function FileUpload({ value, onChange }: {
  value: { name: string; url: string; size?: number; type?: string } | null;
  onChange: (v: { name: string; url: string; size: number; type: string } | null) => void;
}) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange({ name: file.name, url: ev.target?.result as string, size: file.size, type: file.type });
    reader.readAsDataURL(file);
  };

  if (value) {
    return (
      <div className="flex items-center gap-2 text-sm border rounded-xl px-3 py-2 bg-secondary/30">
        <Paperclip className="w-4 h-4 text-primary shrink-0" />
        <span className="flex-1 truncate font-medium">{value.name}</span>
        <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl py-4 px-3 cursor-pointer hover:bg-secondary/20 transition-colors">
      <Upload className="w-5 h-5 text-muted-foreground mb-1.5" />
      <span className="text-xs text-muted-foreground">Importer ticket (PDF, image)</span>
      <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={handleFile} />
    </label>
  );
}

// ─── OSM venue search ─────────────────────────────────────────────────────────

function VenueSearch({ activiteType, onSelect }: {
  activiteType: string;
  onSelect: (p: ActivityPlace) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ActivityPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (query.length < 3) { setResults([]); setOpen(false); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const hint = OSM_HINT[activiteType] ?? "";
        const q = hint ? `${hint} ${query}` : query;
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=7&addressdetails=1&extratags=1&accept-language=fr`;
        const res = await fetch(url, { headers: { "User-Agent": "Ready2Go/1.0" } });
        const data: OsmRaw[] = await res.json();
        const places: ActivityPlace[] = data.map(r => {
          const { address, city, country } = extractAddress(r.address);
          const flag = countryFlag(r.address?.country_code);
          const displayCity = [flag, city, country].filter(Boolean).join(" ");
          return {
            placeId: r.place_id,
            name: r.name ?? query,
            address,
            city,
            country,
            lat: r.lat,
            lon: r.lon,
            displayName: displayCity || r.display_name,
          };
        });
        setResults(places);
        setOpen(places.length > 0);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }, 500);
  }, [query, activiteType]);

  const handleSelect = (p: ActivityPlace) => {
    onSelect(p);
    setQuery(p.name);
    setOpen(false);
  };

  return (
    <div className="relative">
      <Label className="mb-1">Rechercher un lieu <span className="text-muted-foreground text-xs">(facultatif)</span></Label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9 pr-9"
          placeholder={`Chercher un ${ACTIVITE_LABEL[activiteType] ?? "lieu"}…`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
        />
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full bg-background border border-border rounded-xl shadow-lg max-h-56 overflow-y-auto">
          {results.map(p => (
            <li key={p.placeId}>
              <button
                type="button"
                onMouseDown={() => handleSelect(p)}
                className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition-colors"
              >
                <p className="text-sm font-semibold leading-tight truncate">{p.name}</p>
                <p className="text-xs text-muted-foreground truncate">{p.displayName}</p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Submit data ──────────────────────────────────────────────────────────────

export interface ActiviteSubmitData {
  type: EventType;
  title: string;
  date: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  activiteData: Record<string, unknown>;
}

export interface ActiviteInitialVenue {
  name: string;
  lat: number;
  lon: number;
  address?: string;
  city?: string;
  country?: string;
  tags?: Record<string, string>;
}

interface Props {
  tripDate: string;
  tripStartDate: string;
  tripEndDate: string;
  onSubmit: (data: ActiviteSubmitData) => void;
  isPending: boolean;
  onCancel: () => void;
  initialVenue?: ActiviteInitialVenue | null;
  onRequestMapSelect?: () => void;
}

// ─── Form state ───────────────────────────────────────────────────────────────

const blank = {
  activiteType: "",
  name: "",
  address: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  date: "",
  time: "",
  timeEnd: "",
  bookingReference: "",
  website: "",
  notes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

function activiteTypeFromTags(tags?: Record<string, string>): string {
  if (!tags) return "";
  if (tags.tourism === "museum") return "musee";
  if (tags.historic === "castle") return "monument";
  if (tags.historic === "church") return "visite";
  if (tags.tourism === "viewpoint") return "visite";
  if (tags.tourism === "attraction") return "monument";
  return "visite";
}

export function ActiviteForm({ tripDate, tripStartDate, tripEndDate, onSubmit, isPending, onCancel, initialVenue, onRequestMapSelect }: Props) {
  const [d, setD] = useState({ ...blank, date: tripDate });
  const set = (key: keyof typeof blank) => (value: string) => setD(prev => ({ ...prev, [key]: value }));
  const [ticket, setTicket] = useState<{ name: string; url: string; size: number; type: string } | null>(null);

  // Pre-fill from POI click on map
  useEffect(() => {
    if (!initialVenue) return;
    setD(prev => ({
      ...prev,
      name:         initialVenue.name,
      address:      initialVenue.address ?? prev.address,
      city:         initialVenue.city ?? prev.city,
      country:      initialVenue.country ?? prev.country,
      latitude:     String(initialVenue.lat),
      longitude:    String(initialVenue.lon),
      activiteType: activiteTypeFromTags(initialVenue.tags) || prev.activiteType,
    }));
  }, [initialVenue]);

  const selectedType = ACTIVITE_TYPES.find(t => t.value === d.activiteType);
  const fullAddress = [d.address, d.city, d.country].filter(Boolean).join(", ");
  const mapsUrl = fullAddress ? getMapsUrl(d.address, d.city, d.country, d.latitude, d.longitude) : null;
  const wazeUrl = fullAddress ? getWazeUrl(d.address, d.city, d.country, d.latitude, d.longitude) : null;

  const handleVenueSelect = (p: ActivityPlace) => {
    setD(prev => ({
      ...prev,
      name: p.name,
      address: p.address,
      city: p.city,
      country: p.country,
      latitude: p.lat,
      longitude: p.lon,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.activiteType) return;
    const titleParts = [selectedType?.emoji ?? "📍", d.name || (selectedType?.label ?? "Activité")];
    if (d.city) titleParts.push(`· ${d.city}`);
    onSubmit({
      type: "activite",
      title: titleParts.join(" "),
      date: d.date,
      location: fullAddress || null,
      startTime: d.time || null,
      endTime: d.timeEnd || null,
      notes: d.notes || null,
      activiteData: {
        activiteType: d.activiteType,
        name: d.name,
        address: d.address,
        city: d.city,
        country: d.country,
        latitude: d.latitude,
        longitude: d.longitude,
        time: d.time,
        timeEnd: d.timeEnd,
        bookingReference: d.bookingReference,
        website: d.website,
        notes: d.notes,
        ticketName: ticket?.name ?? null,
        ticketUrl: ticket?.url ?? null,
        ticketSize: ticket?.size ?? null,
        ticketType: ticket?.type ?? null,
      },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Type selector ── */}
      <Section title="Type d'activité">
        <div className="grid grid-cols-5 gap-2">
          {ACTIVITE_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setD(prev => ({ ...prev, activiteType: t.value }))}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all",
                d.activiteType === t.value
                  ? "border-event-activite bg-event-activite/10 text-event-activite"
                  : "border-border bg-background text-muted-foreground hover:border-event-activite/50"
              )}
            >
              <span className="text-xl leading-none mb-1">{t.emoji}</span>
              <span className="text-[10px] font-semibold text-center leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {!d.activiteType && <p className="text-xs text-destructive">Veuillez choisir un type</p>}
      </Section>

      {d.activiteType && (
        <>
          {/* ── Lieu ── */}
          <Section title="Lieu">
            {onRequestMapSelect && (
              <button
                type="button"
                onClick={onRequestMapSelect}
                className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-xl py-2.5 mb-1 transition-colors"
              >
                🗺️ Choisir un lieu sur la carte
              </button>
            )}
            <VenueSearch activiteType={d.activiteType} onSelect={handleVenueSelect} />

            <TextInput label="Nom du lieu" value={d.name} onChange={set("name")}
              placeholder={`Ex: Musée du Louvre, Parc des Princes…`} required />

            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Adresse" value={d.address} onChange={set("address")} placeholder="Ex: 1 Rue de la Paix" optional />
              <TextInput label="Ville" value={d.city} onChange={set("city")} placeholder="Ex: Paris" optional />
            </div>
            <TextInput label="Pays" value={d.country} onChange={set("country")} placeholder="Ex: France" optional />

            {/* Maps preview */}
            {fullAddress && (
              <div className="flex gap-2 pt-1 flex-wrap">
                <NavButtons mapsUrl={mapsUrl} wazeUrl={wazeUrl} />
              </div>
            )}
          </Section>

          {/* ── Date & horaires ── */}
          <Section title="Date & horaires">
            <TextInput label="Date" type="date" value={d.date} onChange={set("date")}
              required />
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="Heure de début" type="time" value={d.time} onChange={set("time")} optional />
              <TextInput label="Heure de fin" type="time" value={d.timeEnd} onChange={set("timeEnd")} optional />
            </div>
          </Section>

          {/* ── Infos pratiques ── */}
          <Section title="Infos pratiques">
            <TextInput label="Référence / n° de réservation" value={d.bookingReference} onChange={set("bookingReference")}
              placeholder="Ex: ABC123" optional />
            <TextInput label="Site web" value={d.website} onChange={set("website")}
              placeholder="Ex: https://www.louvre.fr" optional />
          </Section>

          {/* ── Ticket ── */}
          <Section title="Ticket / billet">
            <FileUpload value={ticket} onChange={setTicket} />
          </Section>

          {/* ── Notes ── */}
          <Section title="Notes">
            <div>
              <Label className="mb-1">Notes <span className="text-muted-foreground text-xs">(facultatif)</span></Label>
              <textarea
                value={d.notes}
                onChange={e => set("notes")(e.target.value)}
                rows={3}
                placeholder="Point de rendez-vous, équipements à prévoir…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
          </Section>
        </>
      )}

      {/* ── Actions ── */}
      <div className="flex gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">Annuler</Button>
        <Button type="submit" disabled={isPending || !d.activiteType || !d.date} className="flex-1">
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
