import { useState, useEffect } from "react";
import { format, parseISO, addDays, isBefore, isAfter, differenceInDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, CalendarClock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DayForecast {
  date: string;
  code: number;
  tempMax: number;
  tempMin: number;
}

type WeatherResult =
  | { kind: "ok"; city: string; days: DayForecast[]; isPast: boolean }
  | { kind: "soon"; city: string; daysUntil: number }
  | { kind: "unavailable" };

function wmoToEmoji(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "🌥️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 65) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  if (code <= 86) return "❄️";
  return "⛈️";
}

function wmoToLabel(code: number): string {
  if (code === 0) return "Ensoleillé";
  if (code <= 2) return "Dégagé";
  if (code === 3) return "Nuageux";
  if (code <= 48) return "Brouillard";
  if (code <= 55) return "Bruine";
  if (code <= 65) return "Pluie";
  if (code <= 77) return "Neige";
  if (code <= 82) return "Averses";
  if (code <= 86) return "Neige";
  return "Orage";
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

async function geocode(destination: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const city = destination.split(",")[0].trim();
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=fr&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const r = data.results?.[0];
    if (!r) return null;
    return { lat: r.latitude, lon: r.longitude, name: r.name };
  } catch {
    return null;
  }
}

async function fetchDays(
  lat: number,
  lon: number,
  s: string,
  e: string,
  archive: boolean
): Promise<DayForecast[] | null> {
  const base = archive
    ? `https://archive-api.open-meteo.com/v1/archive`
    : `https://api.open-meteo.com/v1/forecast`;
  try {
    const res = await fetch(
      `${base}?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&start_date=${s}&end_date=${e}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily ?? {};
    if (!time?.length) return null;
    return time.map((date: string, i: number) => ({
      date,
      code: weathercode?.[i] ?? 0,
      tempMax: Math.round(temperature_2m_max?.[i] ?? 0),
      tempMin: Math.round(temperature_2m_min?.[i] ?? 0),
    }));
  } catch {
    return null;
  }
}

async function getWeather(
  lat: number,
  lon: number,
  name: string,
  startDate: string,
  endDate: string
): Promise<WeatherResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const archiveLag = addDays(today, -2);
  const maxForecast = addDays(today, 15);
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  if (isAfter(start, maxForecast)) {
    const daysUntil = differenceInDays(start, maxForecast);
    return { kind: "soon", city: name, daysUntil };
  }

  if (isBefore(end, archiveLag)) {
    const days = await fetchDays(lat, lon, fmt(start), fmt(end), true);
    if (days?.length) return { kind: "ok", city: name, days: days.slice(0, 14), isPast: true };
    return { kind: "unavailable" };
  }

  if (isBefore(start, today)) {
    const clampedPastEnd = isBefore(archiveLag, end) ? archiveLag : end;
    const clampedFutureStart = today;
    const clampedFutureEnd = end > maxForecast ? maxForecast : end;

    const [pastDays, futureDays] = await Promise.all([
      isAfter(clampedPastEnd, start)
        ? fetchDays(lat, lon, fmt(start), fmt(clampedPastEnd), true)
        : Promise.resolve([] as DayForecast[]),
      isBefore(clampedFutureStart, clampedFutureEnd)
        ? fetchDays(lat, lon, fmt(clampedFutureStart), fmt(clampedFutureEnd), false)
        : Promise.resolve([] as DayForecast[]),
    ]);

    const combined = [...(pastDays ?? []), ...(futureDays ?? [])];
    if (combined.length) return { kind: "ok", city: name, days: combined.slice(0, 14), isPast: false };
    return { kind: "unavailable" };
  }

  const clampedEnd = end > maxForecast ? maxForecast : end;
  const days = await fetchDays(lat, lon, fmt(start), fmt(clampedEnd), false);
  if (days?.length) return { kind: "ok", city: name, days: days.slice(0, 14), isPast: false };
  return { kind: "unavailable" };
}

interface Props {
  destination: string;
  startDate: string;
  endDate: string;
}

export function WeatherWidget({ destination, startDate, endDate }: Props) {
  const [result, setResult] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setResult(null);
    (async () => {
      const geo = await geocode(destination);
      if (!geo) { setResult({ kind: "unavailable" }); setLoading(false); return; }
      const r = await getWeather(geo.lat, geo.lon, geo.name, startDate, endDate);
      setResult(r);
      setLoading(false);
    })();
  }, [destination, startDate, endDate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 text-xs text-muted-foreground animate-pulse">
        <span className="text-base">🌡️</span>
        <span>Chargement de la météo…</span>
      </div>
    );
  }

  if (!result || result.kind === "unavailable") return null;

  if (result.kind === "soon") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 text-xs text-slate-600">
        <CalendarClock className="w-4 h-4 text-primary shrink-0" />
        <span>
          Météo de <b>{result.city}</b> disponible dans{" "}
          <b>{result.daysUntil} jour{result.daysUntil > 1 ? "s" : ""}</b>
        </span>
      </div>
    );
  }

  const summary = result.days[0];
  const allMin = Math.min(...result.days.map(d => d.tempMin));
  const allMax = Math.max(...result.days.map(d => d.tempMax));

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/60 transition-colors"
      >
        <span className="text-xl leading-none">{wmoToEmoji(summary.code)}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-700 truncate">{result.city}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {allMin}° – {allMax}°C
          </span>
          {result.days.length > 1 && (
            <span className="text-xs text-muted-foreground ml-2">
              · {result.days.length} jour{result.days.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-medium hidden sm:block">
          {wmoToLabel(summary.code)}
        </span>
        {result.isPast && (
          <span className="text-[10px] text-amber-500 font-semibold px-1.5 py-0.5 bg-amber-50 rounded-lg hidden sm:block">
            Historique
          </span>
        )}
        <span className="ml-auto text-muted-foreground shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="weather-detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 overflow-x-auto">
              <div className="flex gap-2 w-max">
                {result.days.map((day) => {
                  const d = parseISO(day.date);
                  const isToday = format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <div
                      key={day.date}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl min-w-[60px] transition-colors ${
                        isToday
                          ? "bg-primary/10 border border-primary/20"
                          : "bg-slate-50 border border-slate-100"
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wide ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {isToday ? "Auj." : format(d, "EEE", { locale: fr })}
                      </span>
                      <span className="text-xl leading-none">{wmoToEmoji(day.code)}</span>
                      <span className="text-xs font-bold text-slate-800">{day.tempMax}°</span>
                      <span className="text-[10px] text-muted-foreground">{day.tempMin}°</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="px-4 pb-2.5">
              <span className="text-[9px] text-muted-foreground/60">
                Source : Open-Meteo{result.isPast ? " · Données historiques" : ""}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
