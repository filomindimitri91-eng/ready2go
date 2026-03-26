import { useState, useCallback } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Loader2, RefreshCw, Users } from "lucide-react";

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

interface Props {
  destination: string;
  startDate: string;
  endDate: string;
  events: { type: string; title: string }[];
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#06b6d4"];

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

export function BudgetTab({ destination, startDate, endDate, events }: Props) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nbPeople, setNbPeople] = useState(2);
  const [edited, setEdited] = useState<Record<string, number>>({});

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setEdited({});
    try {
      const res = await fetch("/api/ai/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination, startDate, endDate, nbPeople, events }),
      });
      if (!res.ok) throw new Error("Erreur serveur");
      const data = await res.json();
      setBudget(data);
    } catch {
      setError("Impossible de générer le budget. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [destination, startDate, endDate, nbPeople, events]);

  const getAmount = (cat: BudgetCategory) =>
    edited[cat.key] !== undefined ? edited[cat.key] : cat.amount;

  const categories = budget?.categories ?? [];
  const computedTotal = categories.reduce((sum, c) => sum + getAmount(c), 0);
  const currency = budget?.currency ?? "EUR";

  const chartData = categories.map((c) => ({
    name: `${c.emoji} ${c.label}`,
    value: getAmount(c),
  }));

  return (
    <div className="space-y-5">
      {/* Top controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-card border border-border/50 rounded-xl px-3 py-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <label className="text-xs text-muted-foreground font-medium">Personnes :</label>
          <input
            type="number"
            min={1}
            max={20}
            value={nbPeople}
            onChange={(e) => setNbPeople(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-sm font-bold text-center bg-transparent focus:outline-none"
          />
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {budget ? "Régénérer" : "Estimer le budget"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {loading && (
        <div className="flex flex-col items-center gap-3 py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">L'IA estime votre budget…</p>
        </div>
      )}

      {!loading && budget && (
        <>
          {/* Total card */}
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Budget total estimé</p>
              <p className="text-3xl font-bold text-foreground mt-1">{fmt(computedTotal, currency)}</p>
              <p className="text-xs text-muted-foreground mt-1">Pour {nbPeople} personne{nbPeople > 1 ? "s" : ""} · {budget.notes}</p>
            </div>
          </div>

          {/* Pie chart */}
          {chartData.length > 0 && (
            <div className="bg-card border border-border/50 rounded-2xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => fmt(v, currency)}
                    contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Editable categories */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
              Détail par catégorie — modifiable
            </p>
            {categories.map((cat, i) => (
              <div
                key={cat.key}
                className="flex items-center gap-3 bg-card border border-border/50 rounded-xl px-4 py-3"
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
                      setEdited((prev) => ({ ...prev, [cat.key]: val }));
                    }}
                    className="w-24 text-right text-sm font-bold border border-border rounded-lg px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <span className="text-xs text-muted-foreground">{currency}</span>
                </div>
                <div
                  className="w-2 h-8 rounded-full"
                  style={{ backgroundColor: COLORS[i % COLORS.length] }}
                />
              </div>
            ))}
          </div>

          {Object.keys(edited).length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 flex items-center justify-between">
              <p className="text-xs text-blue-700 font-medium">Montants modifiés · Total recalculé</p>
              <button
                onClick={() => setEdited({})}
                className="text-xs text-blue-600 underline"
              >
                Réinitialiser
              </button>
            </div>
          )}
        </>
      )}

      {!loading && !budget && !error && (
        <div className="text-center py-14 bg-card border border-dashed rounded-2xl">
          <p className="text-4xl mb-3">💰</p>
          <p className="font-semibold text-foreground">Estimation IA du budget</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
            Cliquez sur « Estimer le budget » pour obtenir une estimation détaillée et personnalisable.
          </p>
        </div>
      )}
    </div>
  );
}
