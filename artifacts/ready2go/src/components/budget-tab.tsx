import { useState, useMemo, useEffect, useRef } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { ChevronDown, ChevronUp, Coins, RefreshCw, BarChart2, PieChartIcon } from "lucide-react";
import { CURRENCIES, fmtCurrency, CurrencyTab } from "@/components/currency-tab";

// ── Interfaces ────────────────────────────────────────────────────────────────

interface EventItem {
  type: string;
  title: string;
  pricePerPerson: number | null;
  priceType: string | null;
  extraData?: Record<string, unknown>;
}

interface EventCostRow {
  key: string;
  type: string;
  title: string;
  price: number;
  hasPrice: boolean;
  isFree: boolean;
  priceType: string;
  ticketType: string;
  priceMode: string;
  nights: number;
}

interface Props {
  tripId: number;
  destination: string;
  startDate: string;
  endDate: string;
  events: EventItem[];
  travelers: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

const fmt = (n: number, currency = "EUR") => fmtCurrency(n, currency);

const EVENT_EMOJI: Record<string, string> = {
  activite: "🎯", transport: "✈️", logement: "🏨", restauration: "🍽️", reunion: "👥", autre: "📍",
};
const EVENT_LABEL: Record<string, string> = {
  activite: "Activités", transport: "Transport", logement: "Logement",
  restauration: "Restauration", reunion: "Réunion", autre: "Autre",
};

const PRICE_TYPE_LABEL: Record<string, string> = {
  per_person: "/ pers.", per_adult: "/ adulte", per_group: "groupe",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowKey(e: EventItem, idx: number) {
  return `${e.type}__${e.title}__${idx}`;
}

function calcRowTotal(row: EventCostRow, travelers: number): number {
  if (row.isFree || !row.hasPrice) return 0;
  const ticketFactor = row.ticketType === "aller_retour" ? 2 : 1;
  const nightsFactor = row.priceMode === "per_night" && row.nights > 1 ? row.nights : 1;
  if (row.priceType === "per_group") return row.price * ticketFactor * nightsFactor;
  return row.price * travelers * ticketFactor * nightsFactor;
}

function makeRowFromEvent(e: EventItem, idx: number): EventCostRow {
  const extra = e.extraData ?? {};
  return {
    key: rowKey(e, idx),
    type: e.type,
    title: e.title,
    price: e.pricePerPerson ?? 0,
    hasPrice: e.pricePerPerson !== null && e.pricePerPerson !== undefined,
    isFree: e.pricePerPerson === 0,
    priceType: e.priceType ?? "per_person",
    ticketType: (extra.ticketType as string) ?? "aller_simple",
    priceMode: (extra.priceMode as string) ?? "per_stay",
    nights: typeof extra.nights === "number" ? extra.nights : 1,
  };
}

/** Merge fresh event data with any stored price overrides. */
function mergeWithStored(
  fresh: EventCostRow[],
  stored: EventCostRow[],
): EventCostRow[] {
  const storedMap = new Map(stored.map(r => [r.key, r]));
  return fresh.map(row => {
    const s = storedMap.get(row.key);
    if (!s) return row;
    // Accept stored override only for manually editable fields
    return {
      ...row,
      price: s.price,
      isFree: s.isFree,
      // Keep fresh extraData-derived fields (ticketType, priceMode, nights)
    };
  });
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({
  row, travelers, onChange, currency,
}: {
  row: EventCostRow;
  travelers: number;
  onChange: (patch: Partial<EventCostRow>) => void;
  currency: string;
}) {
  const total = calcRowTotal(row, travelers);
  const isPerGroup = row.priceType === "per_group";

  return (
    <div className="bg-card border border-border/50 rounded-xl px-3.5 py-3 space-y-2">
      {/* Title + total */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{EVENT_EMOJI[row.type] ?? "📍"}</span>
            <p className="text-sm font-semibold truncate">{row.title}</p>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {row.priceType && (
              <span className="text-[10px] bg-primary/8 text-primary rounded-md px-1.5 py-0.5 font-medium">
                {PRICE_TYPE_LABEL[row.priceType] ?? row.priceType}
              </span>
            )}
            {row.ticketType === "aller_retour" && (
              <span className="text-[10px] bg-muted/60 text-muted-foreground rounded-md px-1.5 py-0.5">A/R ×2</span>
            )}
            {row.priceMode === "per_night" && row.nights > 1 && (
              <span className="text-[10px] bg-muted/60 text-muted-foreground rounded-md px-1.5 py-0.5">{row.nights} nuits</span>
            )}
            {!row.hasPrice && !row.isFree && (
              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-md px-1.5 py-0.5">Prix à renseigner</span>
            )}
          </div>
        </div>
        <span className={`text-sm font-bold shrink-0 ${total > 0 ? "text-primary" : "text-muted-foreground"}`}>
          {row.isFree ? "Gratuit" : row.hasPrice ? fmt(total, currency) : "—"}
        </span>
      </div>

      {/* Price edit row */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onChange({ isFree: !row.isFree, hasPrice: true })}
          className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
            row.isFree
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-border bg-background text-muted-foreground hover:border-green-400"
          }`}
        >
          {row.isFree ? "✓ Gratuit" : "Gratuit ?"}
        </button>

        {!row.isFree && (
          <>
            <input
              type="number"
              min={0}
              step={0.01}
              value={row.price || ""}
              placeholder="0"
              onChange={e => onChange({ price: Math.max(0, parseFloat(e.target.value) || 0), hasPrice: true })}
              className="w-20 text-right text-xs font-bold border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[10px] text-muted-foreground">{currency}</span>
            <span className="text-[10px] text-muted-foreground">
              {isPerGroup
                ? "forfait groupe"
                : `× ${travelers} voyageur${travelers > 1 ? "s" : ""}`}
              {row.ticketType === "aller_retour" ? " × 2" : ""}
              {row.priceMode === "per_night" && row.nights > 1 ? ` × ${row.nights} nuits` : ""}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── BudgetTab ─────────────────────────────────────────────────────────────────

export function BudgetTab({ tripId, events, travelers }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [showConverter, setShowConverter] = useState(false);
  const [chartType, setChartType] = useState<"pie" | "bar">("pie");

  const STORAGE_KEY = `budget_rows_v2_${tripId}`;

  // Build fresh rows from current events
  const freshRows = useMemo(() => events.map((e, i) => makeRowFromEvent(e, i)), [events]);

  // Initialize from localStorage, merging with fresh event data
  const [eventRows, setEventRows] = useState<EventCostRow[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: EventCostRow[] = JSON.parse(stored);
        if (Array.isArray(parsed)) return mergeWithStored(freshRows, parsed);
      }
    } catch {}
    return freshRows;
  });

  // Sync when events prop changes (new events added, prices updated in forms)
  const prevEventsRef = useRef<string>("");
  useEffect(() => {
    const sig = JSON.stringify(events.map(e => ({
      title: e.title, type: e.type,
      price: e.pricePerPerson, priceType: e.priceType,
      extra: e.extraData,
    })));
    if (sig !== prevEventsRef.current) {
      prevEventsRef.current = sig;
      setEventRows(prev => mergeWithStored(freshRows, prev));
    }
  }, [events, freshRows]);

  // Persist price overrides to localStorage
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(eventRows)); }
    catch {}
  }, [eventRows, STORAGE_KEY]);

  const updateRow = (i: number, patch: Partial<EventCostRow>) => {
    setEventRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const resetPrices = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
    setEventRows(freshRows);
  };

  // Totals
  const grandTotal = useMemo(
    () => eventRows.reduce((s, row) => s + calcRowTotal(row, travelers), 0),
    [eventRows, travelers]
  );
  const perPerson = travelers > 0 ? Math.round(grandTotal / travelers) : 0;

  // Chart data by category
  const chartData = useMemo(() => {
    const byType: Record<string, number> = {};
    eventRows.forEach(row => {
      const total = calcRowTotal(row, travelers);
      if (total > 0) byType[row.type] = (byType[row.type] ?? 0) + total;
    });
    return Object.entries(byType)
      .map(([type, value]) => ({
        name: `${EVENT_EMOJI[type] ?? "📍"} ${EVENT_LABEL[type] ?? type}`,
        shortName: EVENT_LABEL[type] ?? type,
        value: Math.round(value * 100) / 100,
        color: COLORS[Object.keys(EVENT_LABEL).indexOf(type) % COLORS.length] ?? COLORS[0],
      }))
      .sort((a, b) => b.value - a.value);
  }, [eventRows, travelers]);

  // Group events by type
  const groupedByType = useMemo(() => {
    const groups: Record<string, { rows: { row: EventCostRow; idx: number }[]; subtotal: number }> = {};
    eventRows.forEach((row, idx) => {
      if (!groups[row.type]) groups[row.type] = { rows: [], subtotal: 0 };
      groups[row.type].rows.push({ row, idx });
      groups[row.type].subtotal += calcRowTotal(row, travelers);
    });
    return groups;
  }, [eventRows, travelers]);

  const currency = selectedCurrency;
  const hasAnyEvents = eventRows.length > 0;

  return (
    <div className="space-y-5">

      {/* ── Devise + actions ── */}
      <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3">
        <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Devise</span>
        <button
          type="button"
          onClick={resetPrices}
          title="Réinitialiser depuis les événements"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <select
          value={selectedCurrency}
          onChange={e => setSelectedCurrency(e.target.value)}
          className="text-sm font-bold border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.label}</option>
          ))}
        </select>
      </div>

      {!hasAnyEvents ? (
        <div className="text-center py-10 bg-card border border-dashed rounded-2xl">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="text-sm font-semibold text-foreground mb-1">Aucun événement planifié</p>
          <p className="text-xs text-muted-foreground">Ajoutez des événements dans l'onglet Programme pour voir le budget.</p>
        </div>
      ) : (
        <>
          {/* ── Total card ── */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Budget total</p>
                <p className="text-3xl font-bold text-foreground mt-1">{fmt(grandTotal, currency)}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <p className="text-xs text-muted-foreground">
                    {travelers} voyageur{travelers > 1 ? "s" : ""}
                  </p>
                  {travelers > 1 && grandTotal > 0 && (
                    <span className="text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                      ≈ {fmt(perPerson, currency)} / pers.
                    </span>
                  )}
                </div>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>

          {/* ── Chart ── */}
          {chartData.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Répartition par poste
                </p>
                <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setChartType("pie")}
                    className={`p-1.5 rounded-md transition-colors ${chartType === "pie" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <PieChartIcon className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartType("bar")}
                    className={`p-1.5 rounded-md transition-colors ${chartType === "bar" ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {chartType === "pie" ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [fmt(v, currency), ""]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v}€`} width={44} />
                    <Tooltip
                      formatter={(v: number) => [fmt(v, currency), "Total"]}
                      contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 12 }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}

              {/* Category totals row */}
              <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border/40">
                {chartData.map((d, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[11px] text-muted-foreground">{d.shortName}</span>
                    <span className="text-[11px] font-bold text-foreground">{fmt(d.value, currency)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Détail par catégorie ── */}
          <div className="space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Détail par événement
            </p>
            {Object.entries(groupedByType).map(([type, { rows, subtotal }]) => (
              <div key={type} className="space-y-2">
                {/* Category header */}
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{EVENT_EMOJI[type] ?? "📍"}</span>
                    <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                      {EVENT_LABEL[type] ?? type}
                    </span>
                    <span className="text-xs text-muted-foreground">({rows.length})</span>
                  </div>
                  {subtotal > 0 && (
                    <span className="text-xs font-bold text-primary">{fmt(subtotal, currency)}</span>
                  )}
                </div>
                {/* Event rows */}
                {rows.map(({ row, idx }) => (
                  <EventRow
                    key={row.key}
                    row={row}
                    travelers={travelers}
                    onChange={patch => updateRow(idx, patch)}
                    currency={currency}
                  />
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Convertisseur de devises ── */}
      <div className="border border-border/60 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowConverter(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">💱</span>
            <span className="text-sm font-semibold text-foreground">Convertisseur de devises</span>
          </div>
          {showConverter ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showConverter && (
          <div className="bg-card border-t border-border/40">
            <CurrencyTab />
          </div>
        )}
      </div>

    </div>
  );
}
