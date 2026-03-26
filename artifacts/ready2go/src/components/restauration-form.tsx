import React, { useState, useRef, useEffect } from "react";
import { Loader2, Search, Map } from "lucide-react";
import { Button, Input, Label } from "@/components/ui-elements";
import { cn } from "@/lib/utils";
import type { EventType } from "@workspace/api-client-react";
import { getMapsUrl, getWazeUrl } from "./lodging-form";

// ─── Subtypes ─────────────────────────────────────────────────────────────────

const RESTO_TYPES = [
  { value: "restaurant", label: "Restaurant",     emoji: "🍽️" },
  { value: "fastfood",   label: "Fast Food",       emoji: "🍔" },
  { value: "streetfood", label: "Street Food",     emoji: "🥙" },
  { value: "cafe",       label: "Café",            emoji: "☕" },
  { value: "pizzeria",   label: "Pizzeria",        emoji: "🍕" },
  { value: "asian",      label: "Asiatique",       emoji: "🍣" },
  { value: "bar",        label: "Bar / Brasserie", emoji: "🍺" },
  { value: "autre",      label: "Autre",           emoji: "🥗" },
];

export const RESTO_EMOJI: Record<string, string> = Object.fromEntries(RESTO_TYPES.map(t => [t.value, t.emoji]));
export const RESTO_LABEL: Record<string, string> = Object.fromEntries(RESTO_TYPES.map(t => [t.value, t.label]));

const OSM_HINT: Record<string, string> = {
  restaurant: "restaurant",
  fastfood:   "fast food",
  streetfood: "street food",
  cafe:       "café",
  pizzeria:   "pizzeria",
  asian:      "restaurant asiatique",
  bar:        "bar brasserie",
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

export interface RestaurantPlace {
  name: string;
  address: string;
  city: string;
  country: string;
  countryCode: string;
  lat: string;
  lng: string;
  phone: string;
  website: string;
  cuisine: string;
  openingHours: string;
  menuUrl: string;
  description: string;
}

function parseRestaurant(r: OsmRaw): RestaurantPlace {
  const a = r.address ?? {};
  const et = r.extratags ?? {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const city = a.city ?? a.city_district ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
  let country = a.country ?? "";
  if (a.country_code) {
    try {
      country = new Intl.DisplayNames(["fr"], { type: "region" }).of(a.country_code.toUpperCase()) ?? a.country ?? "";
    } catch { country = a.country ?? ""; }
  }
  const name = r.name ?? r.display_name.split(",")[0]?.trim() ?? "";
  const cuisine = (et["cuisine"] ?? "").split(";").map(c => c.trim()).filter(Boolean).join(", ");
  return {
    name,
    address: street,
    city,
    country,
    countryCode: a.country_code ?? "",
    lat: r.lat,
    lng: r.lon,
    phone: et["contact:phone"] ?? et["phone"] ?? "",
    website: et["contact:website"] ?? et["website"] ?? "",
    cuisine,
    openingHours: et["opening_hours"] ?? "",
    menuUrl: et["menu:url"] ?? et["menu"] ?? "",
    description: et["description"] ?? "",
  };
}

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return "🍴";
  return String.fromCodePoint(...code.toUpperCase().split("").map(c => 0x1F1E0 - 65 + c.charCodeAt(0)));
}

// ─── Restaurant search input ──────────────────────────────────────────────────

function RestaurantSearchInput({ value, onChange, onSelect, restoType }: {
  value: string;
  onChange: (v: string) => void;
  onSelect: (place: RestaurantPlace) => void;
  restoType: string;
}) {
  const [results, setResults] = useState<RestaurantPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const box = useRef<HTMLDivElement>(null);

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
      const hint = OSM_HINT[restoType] ?? "";
      const query = hint ? `${q} ${hint}` : q;
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&extratags=1&limit=7&accept-language=fr`;
      const res = await fetch(url, { headers: { "User-Agent": "Ready2Go/1.0" } });
      const data: OsmRaw[] = await res.json();
      const places = data.map(parseRestaurant).filter(p => p.name);
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

  const handleSelect = (place: RestaurantPlace) => {
    onChange(place.name);
    onSelect(place);
    setOpen(false);
    setResults([]);
  };

  return (
    <div ref={box} className="relative">
      <Label>Nom de l'établissement <span className="text-destructive ml-0.5">*</span></Label>
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
            <p className="text-[11px] font-semibold text-primary/70 uppercase tracking-wider">Résultats OpenStreetMap</p>
          </div>
          {results.map((place, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelect(place)}
              className="w-full text-left px-4 py-3.5 hover:bg-primary/5 active:bg-primary/10 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-0"
            >
              <div className="flex items-start gap-2">
                <span className="text-base leading-none mt-0.5 shrink-0">
                  {place.countryCode ? countryFlag(place.countryCode) : "🍴"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-snug">{place.name}</div>
                  {(place.address || place.city) && (
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {[place.address, place.city].filter(Boolean).join(", ")}
                    </div>
                  )}
                  {place.country && <div className="text-xs text-zinc-400 mt-0.5">{place.country}</div>}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {place.cuisine && (
                      <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                        🍴 {place.cuisine}
                      </span>
                    )}
                    {place.openingHours && (
                      <span className="text-[11px] text-zinc-500">🕐 {place.openingHours.split(";")[0]?.trim()}</span>
                    )}
                    {place.phone && <span className="text-[11px] text-primary">📞 {place.phone}</span>}
                  </div>
                </div>
              </div>
            </button>
          ))}
          <div className="px-4 py-1.5 text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 flex items-center gap-1">
            <span>©</span>
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 transition-colors">OpenStreetMap</a>
            <span>contributeurs ODbL</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper UI ────────────────────────────────────────────────────────────────

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

function TextInput({ label, value, onChange, placeholder, required, optional }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; optional?: boolean;
}) {
  return (
    <div>
      <Label>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <Input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function Row2({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function MapsButtons({ address, city, country, lat, lng }: {
  address: string; city: string; country: string; lat?: string | null; lng?: string | null;
}) {
  const full = [address, city, country].filter(Boolean).join(", ");
  if (!full.trim()) return null;
  const mapsUrl = getMapsUrl(address, city, country, lat, lng);
  const wazeUrl = getWazeUrl(address, city, country, lat, lng);
  return (
    <div className="flex gap-2 flex-wrap">
      <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors">
        <Map className="w-3.5 h-3.5" />Google Maps
      </a>
      <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-sky-50 text-sky-600 border border-sky-200 hover:bg-sky-100 transition-colors">
        🚗 Waze
      </a>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RestaurationSubmitData {
  type: EventType;
  title: string;
  date: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  restaurationData: Record<string, unknown>;
}

interface Props {
  tripDate: string;
  tripStartDate: string;
  tripEndDate: string;
  onSubmit: (data: RestaurationSubmitData) => void;
  isPending: boolean;
  onCancel: () => void;
}

// ─── Form state ───────────────────────────────────────────────────────────────

const blank = {
  restoType: "",
  name: "",
  address: "",
  city: "",
  country: "",
  latitude: "",
  longitude: "",
  date: "",
  time: "",
  timeEnd: "",
  guestCount: "",
  bookingReference: "",
  cuisine: "",
  openingHours: "",
  phone: "",
  website: "",
  menuUrl: "",
  menuSummary: "",
  notes: "",
};

// ─── Main component ───────────────────────────────────────────────────────────

export function RestaurationForm({ tripDate, tripStartDate, tripEndDate, onSubmit, isPending, onCancel }: Props) {
  const [d, setD] = useState({ ...blank, date: tripDate });
  const set = (key: keyof typeof blank) => (value: string) => setD(prev => ({ ...prev, [key]: value }));

  const handleOsmSelect = (place: RestaurantPlace) => {
    setD(prev => ({
      ...prev,
      name:         place.name         || prev.name,
      address:      place.address      || prev.address,
      city:         place.city         || prev.city,
      country:      place.country      || prev.country,
      latitude:     place.lat          || prev.latitude,
      longitude:    place.lng          || prev.longitude,
      phone:        place.phone        || prev.phone,
      website:      place.website      || prev.website,
      cuisine:      place.cuisine      || prev.cuisine,
      openingHours: place.openingHours || prev.openingHours,
      menuUrl:      place.menuUrl      || prev.menuUrl,
      menuSummary:  place.description  || prev.menuSummary,
    }));
  };

  const rt = d.restoType;

  function buildTitle() {
    const emoji = RESTO_TYPES.find(t => t.value === rt)?.emoji ?? "🍽️";
    const cityPart = d.city ? ` · ${d.city}` : "";
    return `${emoji} ${d.name}${cityPart}`.trim() || "Restauration";
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rt) return;
    onSubmit({
      type: "restauration" as EventType,
      title: buildTitle(),
      date: d.date || tripDate,
      location: [d.address, d.city].filter(Boolean).join(", ") || null,
      startTime: d.time || null,
      endTime: d.timeEnd || null,
      notes: d.notes || null,
      restaurationData: { ...d },
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Subtype selector */}
      <Section title="Type de restauration">
        <div className="grid grid-cols-4 gap-2">
          {RESTO_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setD(prev => ({ ...blank, date: prev.date, restoType: t.value }))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border-2 transition-all text-center",
                rt === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {!rt && <p className="text-xs text-muted-foreground text-center">Sélectionnez un type pour continuer</p>}
      </Section>

      {rt && (
        <>
          {/* Establishment */}
          <Section title="Établissement">
            <RestaurantSearchInput
              value={d.name}
              onChange={set("name")}
              onSelect={handleOsmSelect}
              restoType={rt}
            />
            {d.cuisine && (
              <div className="flex items-center gap-2 text-sm bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                <span className="text-base">🍴</span>
                <span className="text-amber-800 font-medium">{d.cuisine}</span>
                <button type="button" onClick={() => set("cuisine")("")} className="ml-auto text-amber-500 hover:text-amber-700 text-lg leading-none">×</button>
              </div>
            )}
          </Section>

          {/* Address */}
          <Section title="Adresse">
            <TextInput label="Adresse complète" value={d.address} onChange={set("address")} placeholder="Ex: 12 Rue du Faubourg" required />
            <Row2>
              <TextInput label="Ville" value={d.city} onChange={set("city")} placeholder="Ex: Paris" required />
              <TextInput label="Pays" value={d.country} onChange={set("country")} placeholder="Ex: France" required />
            </Row2>
            {(d.address || d.city) && (
              <MapsButtons address={d.address} city={d.city} country={d.country} lat={d.latitude} lng={d.longitude} />
            )}
          </Section>

          {/* Date & time */}
          <Section title="Date et heure">
            <Row2>
              <div>
                <Label>Date</Label>
                <Input type="date" required min={tripStartDate} max={tripEndDate} value={d.date} onChange={e => set("date")(e.target.value)} />
              </div>
              <div>
                <Label>Heure <span className="text-muted-foreground font-normal">(opt.)</span></Label>
                <Input type="time" value={d.time} onChange={e => set("time")(e.target.value)} />
              </div>
            </Row2>
            <Row2>
              <div>
                <Label>Heure de fin <span className="text-muted-foreground font-normal">(opt.)</span></Label>
                <Input type="time" value={d.timeEnd} onChange={e => set("timeEnd")(e.target.value)} />
              </div>
              <TextInput label="Nombre de convives" value={d.guestCount} onChange={set("guestCount")} placeholder="2" optional />
            </Row2>
          </Section>

          {/* Contact */}
          <Section title="Contact">
            <Row2>
              <TextInput label="Téléphone" value={d.phone} onChange={set("phone")} placeholder="+33 1 42 00 00 00" optional />
              <TextInput label="Site web" value={d.website} onChange={set("website")} placeholder="https://..." optional />
            </Row2>
            {d.openingHours && (
              <div className="bg-muted/40 rounded-xl px-3 py-2">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-1">Horaires (OSM)</p>
                <p className="text-xs font-mono text-foreground/80">{d.openingHours}</p>
              </div>
            )}
          </Section>

          {/* Reservation */}
          <Section title="Réservation">
            <TextInput
              label="Référence / Nom"
              value={d.bookingReference}
              onChange={set("bookingReference")}
              placeholder="Ex: DUPONT — 19h30 — 4 pers."
              optional
            />
          </Section>

          {/* Menu */}
          <Section title="Menu">
            <div>
              <Label>Lien vers le menu <span className="text-muted-foreground font-normal">(opt.)</span></Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={d.menuUrl}
                  onChange={e => set("menuUrl")(e.target.value)}
                  placeholder="https://..."
                />
                {d.menuUrl && d.menuUrl.startsWith("http") && (
                  <a
                    href={d.menuUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 flex items-center text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    Voir
                  </a>
                )}
              </div>
            </div>
            <div>
              <Label>Résumé / Description <span className="text-muted-foreground font-normal">(opt.)</span></Label>
              <textarea
                value={d.menuSummary}
                onChange={e => set("menuSummary")(e.target.value)}
                placeholder="Spécialités, plats recommandés, infos utiles..."
                rows={3}
                className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
              />
            </div>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <div>
              <Label>Notes <span className="text-muted-foreground font-normal">(opt.)</span></Label>
              <textarea
                value={d.notes}
                onChange={e => set("notes")(e.target.value)}
                placeholder="Allergies, préférences, infos à retenir..."
                rows={2}
                className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
              />
            </div>
          </Section>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Annuler</Button>
            <Button type="submit" disabled={isPending} className="flex-1 bg-primary text-primary-foreground">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Ajouter"}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
