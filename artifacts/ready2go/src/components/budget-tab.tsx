import { useState, useCallback, useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, RefreshCw, ChevronDown, ChevronUp, Coins } from "lucide-react";
import { CURRENCIES, fmtCurrency, CurrencyTab } from "@/components/currency-tab";

interface BudgetCategory {
  key: string;
  label: string;
  emoji: string;
  amount: number;
}

interface Budget {
  currency: string;
  total: number;
  notes: string;
  categories: BudgetCategory[];
}

interface EventItem {
  type: string;
  title: string;
  pricePerPerson: number | null;
}

interface EventCostRow {
  type: string;
  title: string;
  basePrice: number;
  adultPrice: number;
  childPrice: number;
  adultFree: boolean;
  childFree: boolean;
}

interface Props {
  destination: string;
  startDate: string;
  endDate: string;
  events: EventItem[];
  adults: number;
  children: number;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

const fmt = (n: number, currency = "EUR") => fmtCurrency(n, currency);

const EVENT_EMOJI: Record<string, string> = {
  activite: "🎯", transport: "🚌", logement: "🏨", restauration: "🍽️", reunion: "👥", autre: "📍",
};
const EVENT_LABEL: Record<string, string> = {
  activite: "Activités", transport: "Transport", logement: "Logement",
  restauration: "Restauration", reunion: "Réunion", autre: "Autre",
};

function PriceToggleRow({
  row,
  adults,
  children,
  onChange,
  currency = "EUR",
}: {
  row: EventCostRow;
  adults: number;
  children: number;
  onChange: (r: Partial<EventCostRow>) => void;
  currency?: string;
}) {
  const adultTotal = row.adultFree ? 0 : row.adultPrice * adults;
  const childTotal = row.childFree ? 0 : row.childPrice * children;
  const lineTotal = adultTotal + childTotal;

  return (
    <div className="bg-card border border-border/50 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium truncate flex-1">{row.title}</span>
        <span className="text-sm font-bold text-primary shrink-0">{fmt(lineTotal, currency)}</span>
      </div>

      {/* Quick free buttons */}
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => onChange({ adultFree: true, childFree: true })}
          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
            row.adultFree && row.childFree
              ? "border-green-500 bg-green-50 text-green-700"
              : "border-border bg-background text-muted-foreground hover:border-green-400"
          }`}
        >
          ✓ Gratuit pour tous
        </button>
        {children > 0 && (
          <button
            type="button"
            onClick={() => onChange({ childFree: true, adultFree: false })}
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
              row.childFree && !row.adultFree
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-border bg-background text-muted-foreground hover:border-blue-300"
            }`}
          >
            Gratuit enfants
          </button>
        )}
        {(row.adultFree || row.childFree) && (
          <button
            type="button"
            onClick={() => onChange({ adultFree: false, childFree: false })}
            className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-border bg-background text-muted-foreground hover:border-red-300 ml-auto"
          >
            Payant
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Adults */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Adultes ({adults})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ adultFree: !row.adultFree })}
              className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                row.adultFree
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border bg-background text-muted-foreground hover:border-green-400"
              }`}
            >
              {row.adultFree ? "✓ Gratuit" : "Gratuit"}
            </button>
            {!row.adultFree && (
              <input
                type="number"
                min={0}
                step={0.01}
                value={row.adultPrice}
                onChange={e => onChange({ adultPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-16 text-right text-xs font-bold border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
            {!row.adultFree && <span className="text-[10px] text-muted-foreground">{currency}</span>}
          </div>
        </div>
        {/* Children */}
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Enfants ({children})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ childFree: !row.childFree })}
              className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                row.childFree
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-border bg-background text-muted-foreground hover:border-green-400"
              }`}
            >
              {row.childFree ? "✓ Gratuit" : "Gratuit"}
            </button>
            {!row.childFree && (
              <input
                type="number"
                min={0}
                step={0.01}
                value={row.childPrice}
                onChange={e => onChange({ childPrice: Math.max(0, parseFloat(e.target.value) || 0) })}
                className="w-16 text-right text-xs font-bold border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            )}
            {!row.childFree && <span className="text-[10px] text-muted-foreground">{currency}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BudgetTab({ destination, startDate, endDate, events, adults, children }: Props) {
  const [selectedCurrency, setSelectedCurrency] = useState("EUR");
  const [showConverter, setShowConverter] = useState(false);

  const pricedEvents = events.filter(e => e.pricePerPerson !== null && e.pricePerPerson !== undefined);

  const [eventRows, setEventRows] = useState<EventCostRow[]>(() =>
    pricedEvents.map(e => ({
      type: e.type,
      title: e.title,
      basePrice: e.pricePerPerson!,
      adultPrice: e.pricePerPerson!,
      childPrice: e.pricePerPerson!,
      adultFree: e.pricePerPerson === 0,
      childFree: e.pricePerPerson === 0,
    }))
  );

  const updateRow = (i: number, patch: Partial<EventCostRow>) => {
    setEventRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  const totalParticipants = adults + children;

  const eventTotal = eventRows.reduce((sum, row) => {
    const a = row.adultFree ? 0 : row.adultPrice * adults;
    const c = row.childFree ? 0 : row.childPrice * children;
    return sum + a + c;
  }, 0);

  const eventChartData = useMemo(() => {
    const byType: Record<string, number> = {};
    eventRows.forEach(row => {
      const total = (row.adultFree ? 0 : row.adultPrice * adults) +
                    (row.childFree ? 0 : row.childPrice * children);
      if (total > 0) byType[row.type] = (byType[row.type] ?? 0) + total;
    });
    return Object.entries(byType).map(([type, value]) => ({
      name: `${EVENT_EMOJI[type] ?? "📍"} ${EVENT_LABEL[type] ?? type}`,
      value,
    }));
  }, [eventRows, adults, children]);

  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [edited, setEdited] = useState<Record<string, number>>({});
  const [showAI, setShowAI] = useState(false);
  const [customNotes, setCustomNotes] = useState("");

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEdited({});
    try {
      const res = await fetch("/api/ai/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, startDate, endDate, nbPeople: totalParticipants, events, customNotes: customNotes || undefined, currency: selectedCurrency }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setBudget(data);
    } catch {
      setError("Impossible de générer le budget. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [destination, startDate, endDate, totalParticipants, events, customNotes, selectedCurrency]);

  const getAmount = (cat: BudgetCategory) =>
    edited[cat.key] !== undefined ? edited[cat.key] : cat.amount;

  const categories = budget?.categories ?? [];
  const aiTotal = categories.reduce((sum, c) => sum + getAmount(c), 0);
  const currency = budget?.currency ?? selectedCurrency;

  const aiChartData = categories.map((c) => ({
    name: `${c.emoji} ${c.label}`,
    value: getAmount(c),
  }));

  return (
    <div className="space-y-5">

      {/* ── Devise (compact dropdown) ── */}
      <div className="bg-card border border-border/50 rounded-2xl px-4 py-3 flex items-center gap-3">
        <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">Devise</span>
        <select
          value={selectedCurrency}
          onChange={e => { setSelectedCurrency(e.target.value); setBudget(null); }}
          className="text-sm font-bold border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          {CURRENCIES.map(c => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.code} — {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* ── Coûts réels des événements ── */}
      {pricedEvents.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Coûts des événements
            </p>
            <p className="text-xs text-muted-foreground">
              {adults} adulte{adults > 1 ? "s" : ""}{children > 0 ? ` · ${children} enfant${children > 1 ? "s" : ""}` : ""}
            </p>
          </div>

          {eventRows.length !== pricedEvents.length && (
            <button
              type="button"
              onClick={() =>
                setEventRows(
                  pricedEvents.map(e => ({
                    type: e.type,
                    title: e.title,
                    basePrice: e.pricePerPerson!,
                    adultPrice: e.pricePerPerson!,
                    childPrice: e.pricePerPerson!,
                    adultFree: e.pricePerPerson === 0,
                    childFree: e.pricePerPerson === 0,
                  }))
                )
              }
              className="text-xs text-primary underline"
            >
              Rafraîchir depuis les événements
            </button>
          )}

          {eventRows.map((row, i) => (
            <PriceToggleRow
              key={i}
              row={row}
              adults={adults}
              children={children}
              onChange={patch => updateRow(i, patch)}
              currency={currency}
            />
          ))}

          {/* Total réel */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">Total réel (événements)</p>
                <p className="text-3xl font-bold text-foreground mt-1">{fmt(eventTotal, currency)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Pour {adults} adulte{adults > 1 ? "s" : ""}{children > 0 ? ` + ${children} enfant${children > 1 ? "s" : ""}` : ""}
                </p>
              </div>
              <span className="text-4xl">💰</span>
            </div>
          </div>

          {/* Graphique par catégorie */}
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
        <div className="text-center py-8 bg-card border border-dashed rounded-2xl">
          <p className="text-3xl mb-2">🎟️</p>
          <p className="text-sm font-semibold text-foreground mb-1">Aucun événement avec prix</p>
          <p className="text-xs text-muted-foreground">
            Ajoutez un prix à vos événements pour voir le calcul ici.
          </p>
        </div>
      )}

      {/* ── Estimation IA (repliable) ── */}
      <div className="border border-border/60 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAI(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🤖</span>
            <span className="text-sm font-semibold text-foreground">Estimation IA du budget</span>
          </div>
          {showAI ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showAI && (
          <div className="px-4 pb-4 pt-2 space-y-4 bg-card">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Instructions pour l'IA <span className="font-normal normal-case">(facultatif)</span>
              </label>
              <textarea
                value={customNotes}
                onChange={e => setCustomNotes(e.target.value)}
                placeholder="Ex : Voyage haut de gamme, hébergement prévu, enfants de 8 et 12 ans..."
                rows={3}
                className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
              />
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {budget ? "Régénérer" : "Estimer le budget"}
              </button>
              <p className="text-xs text-muted-foreground">
                Pour {totalParticipants} personne{totalParticipants > 1 ? "s" : ""}
              </p>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            {loading && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">L'IA estime votre budget…</p>
              </div>
            )}

            {!loading && budget && (
              <>
                <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Budget total estimé</p>
                    <p className="text-2xl font-bold text-foreground mt-1">{fmt(aiTotal, currency)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{budget.notes}</p>
                  </div>
                </div>

                {aiChartData.length > 0 && (
                  <div className="bg-background border border-border/50 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={aiChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {aiChartData.map((_, i) => (
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

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                    Détail — modifiable
                  </p>
                  {categories.map((cat, i) => (
                    <div
                      key={cat.key}
                      className="flex items-center gap-3 bg-background border border-border/50 rounded-xl px-4 py-3"
                    >
                      <span className="text-xl w-7 text-center">{cat.emoji}</span>
                      <span className="flex-1 text-sm font-medium">{cat.label}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          value={getAmount(cat)}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value) || 0);
                            setEdited(prev => ({ ...prev, [cat.key]: val }));
                          }}
                          className="w-24 text-right text-sm font-bold border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                        />
                        <span className="text-xs text-muted-foreground">{currency}</span>
                      </div>
                      <div className="w-2 h-8 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  ))}
                </div>

                {Object.keys(edited).length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center justify-between">
                    <p className="text-xs text-blue-700 font-medium">Montants modifiés · Total recalculé</p>
                    <button onClick={() => setEdited({})} className="text-xs text-blue-600 underline">
                      Réinitialiser
                    </button>
                  </div>
                )}
              </>
            )}

            {!loading && !budget && !error && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Cliquez sur « Estimer le budget » pour une estimation IA personnalisée.
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Convertisseur de devises (repliable) ── */}
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
