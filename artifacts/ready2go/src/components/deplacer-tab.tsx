import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, ExternalLink, Navigation, MapPin, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface NominatimResult {
  place_id: number;
  display_name: string;
  name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  address?: {
    road?: string;
    house_number?: string;
    neighbourhood?: string;
    suburb?: string;
    quarter?: string;
    city_district?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

interface TransitStep {
  mode: string;
  emoji: string;
  line?: string;
  from: string;
  to: string;
  duration: string;
  instruction: string;
}

interface TransitResult {
  summary: string;
  totalDuration: string;
  steps: TransitStep[];
  tips: string;
  mapsUrl: string;
}

interface Props {
  destination: string;
}

const MODE_COLOR: Record<string, string> = {
  metro:  "bg-blue-100 text-blue-700 border-blue-200",
  bus:    "bg-green-100 text-green-700 border-green-200",
  tram:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  rer:    "bg-purple-100 text-purple-700 border-purple-200",
  train:  "bg-orange-100 text-orange-700 border-orange-200",
  marche: "bg-slate-100 text-slate-600 border-slate-200",
  ferry:  "bg-cyan-100 text-cyan-700 border-cyan-200",
  cable:  "bg-rose-100 text-rose-700 border-rose-200",
  autre:  "bg-gray-100 text-gray-600 border-gray-200",
};

const TYPE_ICON: Record<string, string> = {
  station: "🚉", halt: "🚉", railway: "🚉",
  stop_position: "🚏", bus_stop: "🚌", platform: "🚌",
  subway_entrance: "🚇", subway: "🚇",
  tram_stop: "🚋",
  museum: "🏛️", attraction: "⭐", tourism: "⭐",
  restaurant: "🍽️", cafe: "☕", fast_food: "🍔",
  hotel: "🏨", hostel: "🏨",
  airport: "✈️",
  park: "🌳", garden: "🌳",
  hospital: "🏥",
  university: "🎓", school: "🎓",
  stadium: "🏟️",
  neighbourhood: "🏘️", suburb: "🏘️", quarter: "🏘️",
  street: "📍", road: "📍",
};

function getTypeIcon(result: NominatimResult): string {
  return (
    TYPE_ICON[result.type] ??
    TYPE_ICON[result.class] ??
    "📍"
  );
}

/** Extrait le nom court et le sous-titre depuis un résultat Nominatim */
function parseSuggestion(r: NominatimResult): { primary: string; secondary: string; value: string } {
  const a = r.address ?? {};
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? "";
  const district = a.city_district ?? a.suburb ?? a.quarter ?? a.neighbourhood ?? "";

  // Nom principal : nom du lieu ou rue + numéro
  let primary = r.name || "";
  if (!primary && a.road) {
    primary = a.house_number ? `${a.house_number} ${a.road}` : a.road;
  }
  if (!primary) {
    // Dernier recours : premier segment du display_name
    primary = r.display_name.split(",")[0].trim();
  }

  // Sous-titre : quartier + ville
  const parts = [district, city].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
  const secondary = parts.join(", ") || r.display_name.split(",").slice(1, 3).join(",").trim();

  // Valeur à injecter dans le champ de recherche (texte court pour l'IA)
  const value = city ? `${primary}, ${city}` : primary;

  return { primary, secondary, value };
}

/** Extrait seulement le nom de ville depuis la destination du voyage */
function extractCity(destination: string): string {
  // "Lyon, France" → "Lyon" | "New York, USA" → "New York"
  return destination.split(",")[0].trim();
}

function useNominatim(destination: string) {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const query = useCallback(
    (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (!text.trim() || text.length < 2) { setSuggestions([]); return; }
      timerRef.current = setTimeout(async () => {
        abortRef.current?.abort();
        abortRef.current = new AbortController();
        setLoading(true);
        try {
          const city = extractCity(destination);
          // On biaise la recherche sur la ville mais on ne force pas la ville dans la query
          // pour laisser l'utilisateur chercher n'importe où
          const params = new URLSearchParams({
            q: text.includes(",") ? text : `${text}, ${city}`,
            format: "json",
            limit: "7",
            addressdetails: "1",
          });
          const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
            signal: abortRef.current.signal,
            headers: { "Accept-Language": "fr,en;q=0.9" },
          });
          if (!res.ok) throw new Error();
          const data: NominatimResult[] = await res.json();
          setSuggestions(data.slice(0, 6));
        } catch {
          setSuggestions([]);
        } finally {
          setLoading(false);
        }
      }, 280);
    },
    [destination]
  );

  const clear = useCallback(() => setSuggestions([]), []);
  return { suggestions, loading, query, clear };
}

interface PlaceInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  destination: string;
  onEnter: () => void;
}

function PlaceInput({ value, onChange, placeholder, icon, destination, onEnter }: PlaceInputProps) {
  const { suggestions, loading, query, clear } = useNominatim(destination);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      {/* Input */}
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">{icon}</span>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            query(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.length >= 2) { query(value); setOpen(true); }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { setOpen(false); onEnter(); }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="w-full pl-9 pr-8 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        {loading ? (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          </span>
        ) : value ? (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onChange(""); clear(); setOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 right-0 bg-white dark:bg-zinc-900 border border-border rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s) => {
            const { primary, secondary, value: val } = parseSuggestion(s);
            const icon = getTypeIcon(s);
            return (
              <button
                key={s.place_id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(val);
                  clear();
                  setOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 active:bg-primary/10 transition-colors border-b border-border/30 last:border-0"
              >
                <span className="text-xl shrink-0 w-7 text-center">{icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate leading-tight">{primary}</p>
                  {secondary && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5 leading-tight">{secondary}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DeplacerTab({ destination }: Props) {
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");
  const [result,  setResult]  = useState<TransitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [history, setHistory] = useState<{ from: string; to: string; result: TransitResult }[]>([]);

  const search = async () => {
    if (!from.trim() || !to.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const token = localStorage.getItem("r2g_token");
      const res = await fetch("/api/ai/transit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ from: from.trim(), to: to.trim(), city: destination }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as any)?.error ?? `HTTP ${res.status}`);
      }
      const data: TransitResult = await res.json();
      setResult(data);
      setHistory((prev) => [{ from: from.trim(), to: to.trim(), result: data }, ...prev.slice(0, 4)]);
    } catch (err: any) {
      const msg = err?.message ?? "";
      if (msg.includes("Service IA non configuré")) {
        setError("Service IA non disponible sur ce déploiement. Configurez OPENAI_API_KEY pour activer les itinéraires.");
      } else if (msg.includes("401") || msg.includes("Unauthorized")) {
        setError("Session expirée — rechargez la page et reconnectez-vous.");
      } else {
        setError("Impossible d'obtenir l'itinéraire. Vérifiez votre connexion et réessayez.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search form */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Search className="w-3.5 h-3.5" /> Transports en commun — {destination}
        </p>
        <div className="space-y-2">
          <PlaceInput
            value={from}
            onChange={setFrom}
            placeholder="Départ — rue, quartier, station…"
            icon={<MapPin className="w-4 h-4 text-primary" />}
            destination={destination}
            onEnter={search}
          />
          <PlaceInput
            value={to}
            onChange={setTo}
            placeholder="Arrivée — rue, quartier, station…"
            icon={<Navigation className="w-4 h-4 text-green-600" />}
            destination={destination}
            onEnter={search}
          />
        </div>
        <button
          onClick={search}
          disabled={loading || !from.trim() || !to.trim()}
          className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground text-sm font-semibold py-2.5 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "🚌"}
          {loading ? "Calcul en cours…" : "Trouver l'itinéraire"}
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-primary font-semibold uppercase tracking-wider">Itinéraire</p>
              <p className="font-semibold text-foreground mt-0.5 text-sm leading-snug">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">⏱ {result.totalDuration}</p>
            </div>
            {result.mapsUrl && (
              <a
                href={result.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-white border border-primary/20 text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Maps
              </a>
            )}
          </div>

          {/* Steps */}
          {result.steps.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl overflow-hidden divide-y divide-border/40">
              {result.steps.map((step, i) => (
                <div key={i} className="flex gap-3 px-4 py-3 items-start">
                  <div className="flex flex-col items-center pt-0.5 shrink-0">
                    <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center text-lg border shrink-0", MODE_COLOR[step.mode] ?? MODE_COLOR.autre)}>
                      {step.emoji}
                    </div>
                    {i < result.steps.length - 1 && (
                      <div className="w-px h-4 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-1">
                    <div className="flex items-start gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground leading-snug">{step.instruction}</p>
                      {step.line && (
                        <span className={cn("shrink-0 text-xs font-bold px-2 py-0.5 rounded-lg border", MODE_COLOR[step.mode] ?? MODE_COLOR.autre)}>
                          {step.line}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-medium">{step.from}</span>
                      <span className="mx-1">→</span>
                      <span className="font-medium">{step.to}</span>
                      <span className="ml-1 text-muted-foreground/70">· {step.duration}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {result.tips && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex gap-2">
              <span className="shrink-0">💡</span>
              <p className="text-xs text-amber-800 leading-relaxed">{result.tips}</p>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recherches récentes</p>
          {history.slice(1).map((h, i) => (
            <button
              key={i}
              onClick={() => { setFrom(h.from); setTo(h.to); setResult(h.result); }}
              className="w-full flex items-center gap-2 text-sm text-left bg-card border border-border/50 rounded-xl px-3 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <span className="text-muted-foreground shrink-0">🕒</span>
              <span className="font-medium truncate">{h.from}</span>
              <span className="text-muted-foreground shrink-0 text-xs">→</span>
              <span className="font-medium truncate">{h.to}</span>
            </button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-12 bg-card border border-dashed rounded-2xl">
          <p className="text-4xl mb-3">🚌</p>
          <p className="font-semibold text-foreground">Planifier un trajet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Tapez une rue, un quartier ou une station — les suggestions s'affichent automatiquement.
          </p>
        </div>
      )}
    </div>
  );
}
