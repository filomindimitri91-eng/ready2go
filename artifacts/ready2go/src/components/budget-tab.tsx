import { useState, useMemo, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { ChevronDown, ChevronUp, Coins } from "lucide-react";
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
  type: string;
  title: string;
  price: number;
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

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

const fmt = (n: number, currency = "EUR") => fmtCurrency(n, currency);

const EVENT_EMOJI: Record<string, string> = {
  activite: "🎯", transport: "🚌", logement: "🏨", restauration: "🍽️", reunion: "👥", autre: "📍",
};
const EVENT_LABEL: Record<string, string> = {
  activite: "Activités", transport: "Transport", logement: "Logement",
  restauration: "Restauration", reunion: "Réunion", autre: "Autre",
};

const PRICE_TYPE_LABEL: Record<string, string> = {
  per_person: "Par personne", per_adult: "Par adulte", per_group: "Pour le groupe",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcRowTotal(row: EventCostRow, travelers: number): number {
  if (row.isFree) return 0;
  const ticketFactor = row.ticketType === "aller_retour" ? 2 : 1;
  const nightsFactor = row.priceMode === "per_night" && row.nights > 1 ? row.nights : 1;
  if (row.priceType === "per_group") {
    return row.price * ticketFactor * nightsFactor;
  }
  return row.price * travelers * ticketFactor * nightsFactor;
}

function makeRowFromEvent(e: EventItem): EventCostRow {
  const extra = e.extraData ?? {};
  return {
    type: e.type,
    title: e.title,
    price: e.pricePerPerson ?? 0,
    isFree: e.pricePerPerson === 0,
    priceType: e.priceType ?? "per_person",
    ticketType: (extra.ticketType as string) ?? "aller_simple",
    priceMode: (extra.priceMode as string) ?? "per_stay",
    nights: typeof extra.nights === "number" ? extra.nights : 1,
  };
}

// ── EventRow ──────────────────────────────────────────────────────────────────

function EventRow({
  row,
  travelers,
  onChange,
  currency,
}: {
  row: EventCostRow;
  travelers: number;
  onChange: (patch: Partial<EventCostRow>) => void;
  currency: string;
}) {
  const total = calcRowTotal(row, travelers);
  const isPerGroup = row.priceType === "per_group";

  const badges: string[] = [];
  if (PRICE_TYPE_LABEL[row.priceType]) badges.push(PRICE_TYPE_LABEL[row.priceType]);
  if (row.ticketType === "aller_retour") badges.push("Aller-retour ×2");
  if (row.priceMode === "per_night" && row.nights > 1) badges.push(`${row.nights} nuits`);

  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2.5">
      {/* Title + total */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{row.title}</p>
          <div className="flex flex-wrap gap-1 mt-1">
            {badges.map(b => (
              <span key={b} className="text-[10px] bg-muted/60 text-muted-foreground rounded-md px-1.5 py-0.5">{b}</span>
            ))}
          </div>
        </div>
        <span className="text-sm font-bold text-primary shrink-0">{fmt(total, currency)}</span>
      </div>

      {/* Price edit row */}
      <div className="flex items-center gap-2">
        {/* Free toggle */}
        <button
          type="button"
          onClick={() => onChange({ isFree: !row.isFree })}
          className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
            row.isFree
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-border bg-background text-muted-foreground hover:border-green-400"
          }`}
        >
          {row.isFree ? "✓ Gratuit" : "Gratuit"}
        </button>

        {!row.isFree && (
          <>
            <input
              type="number"
              min={0}
              step={0.01}
              value={row.price}
              onChange={e => onChange({ price: Math.max(0, parseFloat(e.target.value) || 0) })}
              className="w-20 text-right text-xs font-bold border border-border rounded-lg px-2 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <span className="text-[10px] text-muted-foreground">{currency}</span>
            <span className="text-[10px] text-muted-foreground">
              {isPerGroup ? "pour le groupe" : `× ${travelers} voyageur${travelers > 1 ? "s" : ""}`}
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

  const pricedEvents = events.filter(e => e.pricePerPerson !== null && e.pricePerPerson !== undefined);

  const STORAGE_KEY = `budget_rows_${tripId}`;

  const [eventRows, setEventRows] = useState<EventCostRow[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: EventCostRow[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length === pricedEvents.length) {
          const matched = parsed.every((r, i) =>
            r.title === pricedEvents[i].title && r.type === pricedEvents[i].type
          );
          if (matched) return parsed;
        }
      }
    } catch {}
    return pricedEvents.map(makeRowFromEvent);
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(eventRows));
    } catch {}
  }, [eventRows, STORAGE_KEY]);

  const updateRow = (i: number, patch: Partial<EventCostRow>) => {
    setEventRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const eventTotal = eventRows.reduce((sum, row) => sum + calcRowTotal(row, travelers), 0);

  const eventChartData = useMemo(() => {
    const byType: Record<string, number> = {};
    eventRows.forEach(row => {
      const total = calcRowTotal(row, travelers);
      if (total > 0) byType[row.type] = (byType[row.type] ?? 0) + total;
    });
    return Object.entries(byType).map(([type, value]) => ({
      name: `${EVENT_EMOJI[type] ?? "📍"} ${EVENT_LABEL[type] ?? type}`,
      value,
    }));
  }, [eventRows, travelers]);

  const currency = selectedCurrency;

  return (
    <div className="space-y-5">

      {/* ── Devise ── */}
      <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3">
        <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Devise</span>
        <select
          value={selectedCurrency}
          onChange={e => setSelectedCurrency(e.target.value)}
          className="text-sm font-bold border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} — {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Détail des coûts ── */}
      {pricedEvents.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Détail du budget
            </p>
            <p className="text-xs text-muted-foreground">
              {travelers} voyageur{travelers > 1 ? "s" : ""}
            </p>
          </div>

          {eventRows.length !== pricedEvents.length && (
            <button
              type="button"
              onClick={() => setEventRows(pricedEvents.map(makeRowFromEvent))}
              className="text-xs text-primary underline"
            >
              Synchroniser avec les événements
            </button>
          )}

          {eventRows.map((row, i) => (
            <EventRow
              key={i}
              row={row}
              travelers={travelers}
              onChange={patch => updateRow(i, patch)}
              currency={currency}
            />
          ))}

          {/* Total */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Total</p>
                <p className="text-3xl font-bold text-foreground mt-1">{fmt(eventTotal, currency)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pour {travelers} voyageur{travelers > 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>

          {/* Répartition par poste */}
          {eventChartData.length > 1 && (
            <div className="bg-background border border-border/50 rounded-2xl p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
                Répartition par poste
              </p>
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Pie
                    data={eventChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {eventChartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v, currency)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 bg-card border border-dashed rounded-2xl">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="text-sm font-semibold text-foreground mb-1">Aucun événement avec prix</p>
          <p className="text-xs text-muted-foreground">
            Ajoutez un prix à vos événements pour voir le budget ici.
          </p>
        </div>
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
