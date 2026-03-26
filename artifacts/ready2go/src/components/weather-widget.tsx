import { useState, useEffect } from "react";
import { format, parseISO, differenceInDays, isAfter, isBefore, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { ChevronDown, ChevronUp, Wind, Droplets } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DayForecast {
  date: string;
  code: number;
  tempMax: number;
  tempMin: number;
}

interface WeatherData {
  city: string;
  days: DayForecast[];
}

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

async function fetchWeather(
  lat: number,
  lon: number,
  startDate: string,
  endDate: string
): Promise<DayForecast[] | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const maxForecast = addDays(today, 15);

  const clampedStart = isAfter(start, today) && isAfter(start, maxForecast) ? null
    : isBefore(end, today) ? null
    : start < today ? today : start;

  if (!clampedStart) return null;

  const clampedEnd = end > maxForecast ? maxForecast : end;
  if (clampedStart > clampedEnd) return null;

  const s = format(clampedStart, "yyyy-MM-dd");
  const e = format(clampedEnd, "yyyy-MM-dd");

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&start_date=${s}&end_date=${e}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    const { time, weathercode, temperature_2m_max, temperature_2m_min } = data.daily ?? {};
    if (!time?.length) return null;
    return time.map((date: string, i: number) => ({
      date,
      code: weathercode[i],
      tempMax: Math.round(temperature_2m_max[i]),
      tempMin: Math.round(temperature_2m_min[i]),
    }));
  } catch {
    return null;
  }
}

interface Props {
  destination: string;
  startDate: string;
  endDate: string;
}

export function WeatherWidget({ destination, startDate, endDate }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoading(true);
    setUnavailable(false);
    setWeather(null);

    (async () => {
      const geo = await geocode(destination);
      if (!geo) { setUnavailable(true); setLoading(false); return; }
      const days = await fetchWeather(geo.lat, geo.lon, startDate, endDate);
      if (!days || days.length === 0) { setUnavailable(true); setLoading(false); return; }
      setWeather({ city: geo.name, days });
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

  if (unavailable || !weather) {
    return null;
  }

  const summary = weather.days[0];
  const allMin = Math.min(...weather.days.map(d => d.tempMin));
  const allMax = Math.max(...weather.days.map(d => d.tempMax));

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-white/60 overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/60 transition-colors"
      >
        <span className="text-xl leading-none">{wmoToEmoji(summary.code)}</span>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-slate-700 truncate">{weather.city}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {allMin}° – {allMax}°C
          </span>
          {weather.days.length > 1 && (
            <span className="text-xs text-muted-foreground ml-2">
              · {weather.days.length} jour{weather.days.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-[10px] text-muted-foreground font-medium hidden sm:block">
          {wmoToLabel(summary.code)}
        </span>
        <span className="ml-auto text-muted-foreground shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {/* Expanded daily strip */}
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
                {weather.days.map((day) => {
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
            <div className="flex items-center gap-1 px-4 pb-2.5">
              <span className="text-[9px] text-muted-foreground/60">Source : Open-Meteo</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
