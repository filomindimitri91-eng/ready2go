import { useState } from "react";
import { Loader2, ExternalLink, Navigation, MapPin } from "lucide-react";

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
  metro: "bg-blue-100 text-blue-700 border-blue-200",
  bus: "bg-green-100 text-green-700 border-green-200",
  tram: "bg-yellow-100 text-yellow-700 border-yellow-200",
  rer: "bg-purple-100 text-purple-700 border-purple-200",
  train: "bg-orange-100 text-orange-700 border-orange-200",
  marche: "bg-slate-100 text-slate-600 border-slate-200",
  autre: "bg-gray-100 text-gray-600 border-gray-200",
};

export function DeplacerTab({ destination }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState<TransitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<{ from: string; to: string; result: TransitResult }[]>([]);

  const search = async () => {
    if (!from.trim() || !to.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai/transit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: from.trim(), to: to.trim(), city: destination }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data: TransitResult = await res.json();
      setResult(data);
      setHistory((prev) => [{ from: from.trim(), to: to.trim(), result: data }, ...prev.slice(0, 4)]);
    } catch {
      setError("Impossible d'obtenir l'itinéraire. Réessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search form */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Transports en commun — {destination}
        </p>
        <div className="space-y-2">
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Départ (ex : Musée du Louvre)"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-600" />
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
              placeholder="Arrivée (ex : Tour Eiffel)"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
          </div>
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
        <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          {/* Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-primary font-semibold uppercase tracking-wider">Itinéraire</p>
              <p className="font-semibold text-foreground mt-0.5 text-sm">{result.summary}</p>
              <p className="text-xs text-muted-foreground mt-0.5">⏱ {result.totalDuration}</p>
            </div>
            {result.mapsUrl && (
              <a
                href={result.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 flex items-center gap-1.5 text-xs font-semibold bg-white border border-primary/20 text-primary px-3 py-2 rounded-xl hover:bg-primary/5 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Google Maps
              </a>
            )}
          </div>

          {/* Steps */}
          {result.steps.length > 0 && (
            <div className="space-y-2">
              {result.steps.map((step, i) => (
                <div key={i} className="flex gap-3 items-start">
                  {/* Line connector */}
                  <div className="flex flex-col items-center pt-1">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base border ${MODE_COLOR[step.mode] ?? MODE_COLOR.autre}`}>
                      {step.emoji}
                    </div>
                    {i < result.steps.length - 1 && (
                      <div className="w-0.5 h-4 bg-border mt-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{step.instruction}</p>
                      {step.line && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${MODE_COLOR[step.mode] ?? MODE_COLOR.autre}`}>
                          {step.line}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {step.from} → {step.to} · {step.duration}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tips */}
          {result.tips && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              <p className="text-xs text-amber-800">💡 {result.tips}</p>
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
              className="w-full flex items-center gap-2 text-sm text-left bg-card border border-border/50 rounded-xl px-3 py-2 hover:bg-muted/40 transition-colors"
            >
              <span className="text-muted-foreground">🕒</span>
              <span className="font-medium truncate">{h.from}</span>
              <span className="text-muted-foreground shrink-0">→</span>
              <span className="font-medium truncate">{h.to}</span>
            </button>
          ))}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="text-center py-12 bg-card border border-dashed rounded-2xl">
          <p className="text-4xl mb-3">🚌</p>
          <p className="font-semibold text-foreground">Planifier un trajet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Saisissez un point de départ et une destination pour obtenir l'itinéraire en transports en commun.
          </p>
        </div>
      )}
    </div>
  );
}
