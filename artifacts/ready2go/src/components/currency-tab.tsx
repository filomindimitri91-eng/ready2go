import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Search, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui-elements";

// ─── Currency data ────────────────────────────────────────────────────────────

export const CURRENCIES: { code: string; label: string; flag: string }[] = [
  { code: "EUR", label: "Euro",                    flag: "🇪🇺" },
  { code: "USD", label: "Dollar américain",        flag: "🇺🇸" },
  { code: "GBP", label: "Livre sterling",          flag: "🇬🇧" },
  { code: "CHF", label: "Franc suisse",            flag: "🇨🇭" },
  { code: "JPY", label: "Yen japonais",            flag: "🇯🇵" },
  { code: "CAD", label: "Dollar canadien",         flag: "🇨🇦" },
  { code: "AUD", label: "Dollar australien",       flag: "🇦🇺" },
  { code: "CNY", label: "Yuan chinois",            flag: "🇨🇳" },
  { code: "INR", label: "Roupie indienne",         flag: "🇮🇳" },
  { code: "BRL", label: "Réal brésilien",          flag: "🇧🇷" },
  { code: "MXN", label: "Peso mexicain",           flag: "🇲🇽" },
  { code: "TRY", label: "Livre turque",            flag: "🇹🇷" },
  { code: "MAD", label: "Dirham marocain",         flag: "🇲🇦" },
  { code: "TND", label: "Dinar tunisien",          flag: "🇹🇳" },
  { code: "DZD", label: "Dinar algérien",          flag: "🇩🇿" },
  { code: "EGP", label: "Livre égyptienne",        flag: "🇪🇬" },
  { code: "SAR", label: "Riyal saoudien",          flag: "🇸🇦" },
  { code: "AED", label: "Dirham des EAU",          flag: "🇦🇪" },
  { code: "THB", label: "Baht thaïlandais",        flag: "🇹🇭" },
  { code: "IDR", label: "Roupie indonésienne",     flag: "🇮🇩" },
  { code: "VND", label: "Dong vietnamien",         flag: "🇻🇳" },
  { code: "KRW", label: "Won sud-coréen",          flag: "🇰🇷" },
  { code: "SGD", label: "Dollar de Singapour",     flag: "🇸🇬" },
  { code: "HKD", label: "Dollar de Hong Kong",     flag: "🇭🇰" },
  { code: "NZD", label: "Dollar néo-zélandais",    flag: "🇳🇿" },
  { code: "SEK", label: "Couronne suédoise",       flag: "🇸🇪" },
  { code: "NOK", label: "Couronne norvégienne",    flag: "🇳🇴" },
  { code: "DKK", label: "Couronne danoise",        flag: "🇩🇰" },
  { code: "PLN", label: "Złoty polonais",          flag: "🇵🇱" },
  { code: "CZK", label: "Couronne tchèque",        flag: "🇨🇿" },
  { code: "HUF", label: "Forint hongrois",         flag: "🇭🇺" },
  { code: "RON", label: "Leu roumain",             flag: "🇷🇴" },
  { code: "BGN", label: "Lev bulgare",             flag: "🇧🇬" },
  { code: "HRK", label: "Kuna croate",             flag: "🇭🇷" },
  { code: "RUB", label: "Rouble russe",            flag: "🇷🇺" },
  { code: "UAH", label: "Hryvnia ukrainienne",     flag: "🇺🇦" },
  { code: "ZAR", label: "Rand sud-africain",       flag: "🇿🇦" },
  { code: "MYR", label: "Ringgit malaisien",       flag: "🇲🇾" },
  { code: "PHP", label: "Peso philippin",          flag: "🇵🇭" },
  { code: "PKR", label: "Roupie pakistanaise",     flag: "🇵🇰" },
  { code: "BDT", label: "Taka bangladais",         flag: "🇧🇩" },
  { code: "CLP", label: "Peso chilien",            flag: "🇨🇱" },
  { code: "COP", label: "Peso colombien",          flag: "🇨🇴" },
  { code: "ARS", label: "Peso argentin",           flag: "🇦🇷" },
  { code: "PEN", label: "Sol péruvien",            flag: "🇵🇪" },
  { code: "NGN", label: "Naira nigérian",          flag: "🇳🇬" },
  { code: "KES", label: "Shilling kényan",         flag: "🇰🇪" },
  { code: "GHS", label: "Cedi ghanéen",            flag: "🇬🇭" },
  { code: "ETB", label: "Birr éthiopien",          flag: "🇪🇹" },
  { code: "TZS", label: "Shilling tanzanien",      flag: "🇹🇿" },
  { code: "UGX", label: "Shilling ougandais",      flag: "🇺🇬" },
  { code: "XOF", label: "Franc CFA (UEMOA)",       flag: "🌍" },
  { code: "XAF", label: "Franc CFA (CEMAC)",       flag: "🌍" },
  { code: "ILS", label: "Nouveau shekel",          flag: "🇮🇱" },
  { code: "QAR", label: "Riyal qatari",            flag: "🇶🇦" },
  { code: "KWD", label: "Dinar koweïtien",         flag: "🇰🇼" },
  { code: "BHD", label: "Dinar bahreïni",          flag: "🇧🇭" },
  { code: "OMR", label: "Rial omanais",            flag: "🇴🇲" },
  { code: "JOD", label: "Dinar jordanien",         flag: "🇯🇴" },
  { code: "LBP", label: "Livre libanaise",         flag: "🇱🇧" },
  { code: "IRR", label: "Rial iranien",            flag: "🇮🇷" },
  { code: "IQD", label: "Dinar irakien",           flag: "🇮🇶" },
  { code: "LYD", label: "Dinar libyen",            flag: "🇱🇾" },
  { code: "SDG", label: "Livre soudanaise",        flag: "🇸🇩" },
  { code: "MUR", label: "Roupie mauricienne",      flag: "🇲🇺" },
  { code: "SCR", label: "Roupie seychelloise",     flag: "🇸🇨" },
  { code: "KZT", label: "Tenge kazakh",            flag: "🇰🇿" },
  { code: "GEL", label: "Lari géorgien",           flag: "🇬🇪" },
  { code: "AMD", label: "Dram arménien",           flag: "🇦🇲" },
  { code: "AZN", label: "Manat azerbaïdjanais",    flag: "🇦🇿" },
  { code: "UZS", label: "Sum ouzbek",              flag: "🇺🇿" },
  { code: "MNT", label: "Tugrik mongol",           flag: "🇲🇳" },
  { code: "KHR", label: "Riel cambodgien",         flag: "🇰🇭" },
  { code: "LAK", label: "Kip laotien",             flag: "🇱🇦" },
  { code: "MMK", label: "Kyat birman",             flag: "🇲🇲" },
  { code: "NPR", label: "Roupie népalaise",        flag: "🇳🇵" },
  { code: "LKR", label: "Roupie sri-lankaise",     flag: "🇱🇰" },
  { code: "MVR", label: "Rufiyaa maldivien",       flag: "🇲🇻" },
  { code: "TWD", label: "Dollar de Taïwan",        flag: "🇹🇼" },
  { code: "MOP", label: "Pataca macanais",         flag: "🇲🇴" },
  { code: "ISK", label: "Couronne islandaise",     flag: "🇮🇸" },
  { code: "HRK", label: "Kuna croate",             flag: "🇭🇷" },
  { code: "RSD", label: "Dinar serbe",             flag: "🇷🇸" },
  { code: "ALL", label: "Lek albanais",            flag: "🇦🇱" },
  { code: "MKD", label: "Denar macédonien",        flag: "🇲🇰" },
  { code: "BAM", label: "Mark bosnien",            flag: "🇧🇦" },
  { code: "MDL", label: "Leu moldave",             flag: "🇲🇩" },
  { code: "BYN", label: "Rouble biélorusse",       flag: "🇧🇾" },
  { code: "TTD", label: "Dollar de Trinité",       flag: "🇹🇹" },
  { code: "JMD", label: "Dollar jamaïcain",        flag: "🇯🇲" },
  { code: "BBD", label: "Dollar de la Barbade",    flag: "🇧🇧" },
  { code: "XCD", label: "Dollar des Caraïbes",     flag: "🏝️" },
  { code: "DOP", label: "Peso dominicain",         flag: "🇩🇴" },
  { code: "GTQ", label: "Quetzal guatémaltèque",   flag: "🇬🇹" },
  { code: "HNL", label: "Lempira hondurien",       flag: "🇭🇳" },
  { code: "NIO", label: "Córdoba nicaraguayen",    flag: "🇳🇮" },
  { code: "CRC", label: "Colón costaricain",       flag: "🇨🇷" },
  { code: "PAB", label: "Balboa panaméen",         flag: "🇵🇦" },
  { code: "BOB", label: "Boliviano bolivien",      flag: "🇧🇴" },
  { code: "PYG", label: "Guaraní paraguayen",      flag: "🇵🇾" },
  { code: "UYU", label: "Peso uruguayen",          flag: "🇺🇾" },
  { code: "VES", label: "Bolívar vénézuélien",     flag: "🇻🇪" },
];

export const CURRENCY_MAP = Object.fromEntries(CURRENCIES.map(c => [c.code, c]));

// ─── Currency format ──────────────────────────────────────────────────────────

export function fmtCurrency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: code === "JPY" || code === "KRW" || code === "VND" || code === "IDR" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

// ─── Top currencies shown in quick-pick ───────────────────────────────────────

export const TOP_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "MAD", "TND", "DZD", "TRY", "AED", "SAR"];

// ─── Currency Tab Component ───────────────────────────────────────────────────

interface Rates { [code: string]: number }

export function CurrencyTab() {
  const [amount, setAmount] = useState("100");
  const [fromCurrency, setFromCurrency] = useState("EUR");
  const [rates, setRates] = useState<Rates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const fetchRates = useCallback(async (base: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${base}`);
      if (!res.ok) throw new Error("Erreur réseau");
      const data = await res.json();
      if (data.result !== "success") throw new Error("Taux indisponibles");
      setRates(data.rates as Rates);
      setLastUpdated(new Date(data.time_last_update_utc).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }));
    } catch {
      setError("Impossible de récupérer les taux de change. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRates(fromCurrency);
  }, [fromCurrency, fetchRates]);

  const parsedAmount = parseFloat(amount) || 0;

  const filtered = CURRENCIES.filter(c =>
    c.code !== fromCurrency &&
    (search === "" ||
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.label.toLowerCase().includes(search.toLowerCase()))
  );

  const fromInfo = CURRENCY_MAP[fromCurrency] || { code: fromCurrency, label: fromCurrency, flag: "💱" };

  const handleSwap = (target: string) => {
    setFromCurrency(target);
    setSearch("");
    setShowPicker(false);
  };

  return (
    <div className="space-y-5">
      {/* ── Source currency + amount ── */}
      <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ArrowRightLeft className="w-3.5 h-3.5" /> Convertisseur de devises
        </p>

        {/* Amount input */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Montant</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step="any"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="flex-1 h-12 rounded-xl border-2 border-border bg-background px-4 text-xl font-bold text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
              placeholder="100"
            />
            <button
              onClick={() => setShowPicker(v => !v)}
              className="flex items-center gap-2 h-12 px-4 rounded-xl border-2 border-border bg-background hover:border-primary transition-all font-bold text-base whitespace-nowrap"
            >
              <span className="text-xl">{fromInfo.flag}</span>
              <span>{fromInfo.code}</span>
            </button>
          </div>
        </div>

        {/* Currency picker */}
        {showPicker && (
          <div className="border border-border rounded-2xl overflow-hidden bg-background">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  autoFocus
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Rechercher une devise..."
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto">
              {CURRENCIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { setFromCurrency(c.code); setShowPicker(false); setSearch(""); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/60 transition-colors ${fromCurrency === c.code ? "bg-primary/5 text-primary font-semibold" : ""}`}
                >
                  <span className="text-base">{c.flag}</span>
                  <span className="font-medium">{c.code}</span>
                  <span className="text-muted-foreground ml-auto text-xs">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick currency pick */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-2">Devises rapides</label>
          <div className="flex flex-wrap gap-1.5">
            {TOP_CURRENCIES.map(code => {
              const c = CURRENCY_MAP[code];
              if (!c) return null;
              return (
                <button
                  key={code}
                  onClick={() => setFromCurrency(code)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                    fromCurrency === code
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {c.flag} {code}
                </button>
              );
            })}
          </div>
        </div>

        {lastUpdated && (
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">Taux mis à jour : {lastUpdated}</p>
            <button
              onClick={() => fetchRates(fromCurrency)}
              disabled={loading}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Actualiser
            </button>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Chargement des taux…</p>
          </div>
        )}
        {error && !loading && (
          <div className="p-4 text-sm text-red-500 bg-red-50 m-4 rounded-xl">{error}</div>
        )}
        {!loading && !error && rates && (
          <>
            {/* Search results */}
            <div className="p-3 border-b border-border/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Filtrer les devises…"
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {filtered.map(c => {
                const rate = rates[c.code];
                if (!rate) return null;
                const converted = parsedAmount * rate;
                return (
                  <div key={c.code} className="flex items-center px-4 py-3">
                    <span className="text-xl mr-3 shrink-0">{c.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{c.code}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{c.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">
                        {fmtCurrency(converted, c.code)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        1 {fromCurrency} = {rate < 0.01 ? rate.toFixed(6) : rate < 1 ? rate.toFixed(4) : rate.toFixed(4)} {c.code}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSwap(c.code)}
                      className="ml-3 shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors"
                      title={`Convertir depuis ${c.code}`}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune devise trouvée</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
