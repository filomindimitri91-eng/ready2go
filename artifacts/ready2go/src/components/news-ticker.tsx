import { useState, useEffect, ReactNode } from "react";
import { Loader2, Newspaper, TriangleAlert, Plane, CloudRain, CalendarDays, X, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsItem {
  title: string;
  category: "alert" | "transport" | "weather" | "event" | "info";
  url?: string;
}

interface Props {
  destination: string;
  events?: { type: string; title?: string; transportData?: any }[];
}

const CATEGORY_STYLE: Record<
  NewsItem["category"],
  { icon: ReactNode; bg: string; dot: string; label: string }
> = {
  alert:     { icon: <TriangleAlert className="w-3.5 h-3.5 shrink-0" />, bg: "text-amber-700",  dot: "bg-amber-400",  label: "Alerte" },
  transport: { icon: <Plane className="w-3.5 h-3.5 shrink-0" />,         bg: "text-sky-700",    dot: "bg-sky-400",    label: "Transport" },
  weather:   { icon: <CloudRain className="w-3.5 h-3.5 shrink-0" />,     bg: "text-violet-700", dot: "bg-violet-400", label: "Météo" },
  event:     { icon: <CalendarDays className="w-3.5 h-3.5 shrink-0" />,  bg: "text-rose-700",   dot: "bg-rose-400",   label: "Événement" },
  info:      { icon: <Newspaper className="w-3.5 h-3.5 shrink-0" />,     bg: "text-slate-600",  dot: "bg-slate-400",  label: "Info" },
};

const FALLBACK_ITEMS: NewsItem[] = [
  { title: "Consultez les alertes trafic avant votre départ", category: "transport" },
  { title: "Vérifiez les conditions météo locales à destination", category: "weather" },
  { title: "Pensez à vérifier l'état de vos documents de voyage", category: "info" },
  { title: "Vérifiez les horaires de vos réservations 24h avant", category: "info" },
];

function TickerItem({ item }: { item: NewsItem }) {
  const style = CATEGORY_STYLE[item.category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 whitespace-nowrap text-[11px] font-medium", style.bg)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {style.icon}
      <span>{item.title}</span>
      <span className="mx-3 text-slate-300/70 select-none">|</span>
    </span>
  );
}

export function NewsTicker({ destination, events }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const token = typeof window !== "undefined" ? localStorage.getItem("r2g_token") : null;

  const operatorsKey = (events ?? [])
    .filter(e => e.type === "transport" && e.transportData?.provider)
    .map(e => e.transportData!.provider as string)
    .filter(Boolean)
    .sort()
    .join(",");

  useEffect(() => {
    if (!destination) return;
    const operators = operatorsKey ? operatorsKey.split(",") : [];
    const ctrl = new AbortController();
    fetch("/api/ai/travel-news", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ destination, operators: [...new Set(operators)] }),
      signal: ctrl.signal,
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        setItems(Array.isArray(data.items) && data.items.length > 0 ? data.items : FALLBACK_ITEMS);
      })
      .catch(() => setItems(FALLBACK_ITEMS))
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [destination, operatorsKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: "rgba(255,255,255,0.50)", border: "1px solid rgba(255,255,255,0.60)" }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
        <span className="text-[11px] text-slate-400">Chargement des actualités voyage…</span>
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
    <div className="relative">
      {/* Panel liste articles */}
      {showPanel && (
        <div
          className="absolute bottom-[calc(100%+6px)] left-0 right-0 z-40 rounded-2xl shadow-xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.80)",
          }}
        >
          {/* Header panel */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">📰 Actualités voyage — {destination.split(",")[0]}</p>
            <button
              onClick={() => setShowPanel(false)}
              className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {/* Liste */}
          <div className="max-h-72 overflow-y-auto divide-y divide-slate-50">
            {items.map((item, i) => {
              const style = CATEGORY_STYLE[item.category];
              return (
                <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-primary/5 transition-colors">
                  <span className={cn("mt-0.5 shrink-0", style.bg)}>{style.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className={cn("text-[10px] font-semibold uppercase tracking-wider", style.bg)}>{style.label}</span>
                    {item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-1 group"
                      >
                        <p className="text-sm text-slate-700 leading-snug mt-0.5 group-hover:text-primary group-hover:underline flex-1">{item.title}</p>
                        <ExternalLink className="w-3 h-3 shrink-0 mt-1 text-slate-300 group-hover:text-primary" />
                      </a>
                    ) : (
                      <p className="text-sm text-slate-700 leading-snug mt-0.5">{item.title}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Barre ticker */}
      <div
        className="relative overflow-hidden rounded-xl py-2"
        style={{
          background: "rgba(255,255,255,0.50)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.60)",
          borderRadius: "0.75rem",
        }}
      >
        <div className="flex items-center">
          {/* Badge cliquable */}
          <button
            onClick={() => setShowPanel(v => !v)}
            className={cn(
              "shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mx-2 rounded-lg whitespace-nowrap transition-colors",
              showPanel
                ? "bg-primary text-primary-foreground"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            📰 Actus
          </button>
          {/* Défilement */}
          <div className="overflow-hidden flex-1 min-w-0">
            <div className="flex animate-ticker">
              {doubled.map((item, i) => (
                <TickerItem key={i} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Clic extérieur ferme le panneau */}
      {showPanel && (
        <div className="fixed inset-0 z-30" onClick={() => setShowPanel(false)} />
      )}
    </div>
  );
}
