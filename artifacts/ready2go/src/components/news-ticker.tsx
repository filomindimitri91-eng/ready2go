import { useState, useEffect, useRef } from "react";
import { Loader2, Newspaper, TriangleAlert, Plane, CloudRain, CalendarDays } from "lucide-react";
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

const CATEGORY_STYLE: Record<NewsItem["category"], { icon: React.ReactNode; bg: string; dot: string }> = {
  alert:     { icon: <TriangleAlert className="w-3 h-3 shrink-0" />, bg: "text-amber-700", dot: "bg-amber-400" },
  transport: { icon: <Plane className="w-3 h-3 shrink-0" />,         bg: "text-sky-700",   dot: "bg-sky-400" },
  weather:   { icon: <CloudRain className="w-3 h-3 shrink-0" />,     bg: "text-violet-700",dot: "bg-violet-400" },
  event:     { icon: <CalendarDays className="w-3 h-3 shrink-0" />,  bg: "text-rose-700",  dot: "bg-rose-400" },
  info:      { icon: <Newspaper className="w-3 h-3 shrink-0" />,     bg: "text-slate-600", dot: "bg-slate-400" },
};

const FALLBACK_ITEMS: NewsItem[] = [
  { title: "Consultez les alertes trafic avant votre départ", category: "transport" },
  { title: "Vérifiez les conditions météo locales à destination", category: "weather" },
  { title: "Pensez à vérifier l'état de vos documents de voyage", category: "info" },
  { title: "Vérifiez les horaires de vos réservations 24h avant", category: "info" },
];

function NewsItem({ item }: { item: NewsItem }) {
  const style = CATEGORY_STYLE[item.category];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 whitespace-nowrap text-[11px] font-medium", style.bg)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
      {style.icon}
      {item.url ? (
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
          {item.title}
        </a>
      ) : (
        <span>{item.title}</span>
      )}
      <span className="mx-3 text-slate-300/70 select-none">|</span>
    </span>
  );
}

export function NewsTicker({ destination, events }: Props) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
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
        if (Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
        } else {
          setItems(FALLBACK_ITEMS);
        }
      })
      .catch(() => setItems(FALLBACK_ITEMS))
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [destination, operatorsKey]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 bg-white/50 backdrop-blur-sm border border-white/60 rounded-xl px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />
        <span className="text-[11px] text-slate-400">Chargement des actualités voyage…</span>
      </div>
    );
  }

  const doubled = [...items, ...items];

  return (
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
        <span className="shrink-0 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 mx-2 rounded-lg whitespace-nowrap">
          📰 Actus
        </span>
        <div className="overflow-hidden flex-1 min-w-0">
          <div className="flex animate-ticker">
            {doubled.map((item, i) => (
              <NewsItem key={i} item={item} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
