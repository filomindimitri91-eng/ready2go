import { detectCountry } from "@/lib/emergency-numbers";

interface Props {
  destination: string;
}

const SERVICES = [
  { key: "general" as const,   label: "Urgences",    emoji: "🆘", color: "text-red-600    bg-red-50    border-red-200" },
  { key: "police" as const,    label: "Police",      emoji: "👮", color: "text-blue-700   bg-blue-50   border-blue-200" },
  { key: "ambulance" as const, label: "Ambulance",   emoji: "🚑", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { key: "fire" as const,      label: "Pompiers",    emoji: "🚒", color: "text-orange-700 bg-orange-50 border-orange-200" },
];

export function EmergencyTab({ destination }: Props) {
  const info = detectCountry(destination);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-3xl">{info.flag}</span>
        <div>
          <p className="font-bold text-red-700 text-base">{info.country}</p>
          <p className="text-xs text-red-500">Numéros valables sur tout le territoire</p>
        </div>
      </div>

      {/* Emergency numbers grid */}
      <div className="grid grid-cols-2 gap-3">
        {SERVICES.map(({ key, label, emoji, color }) => {
          const number = info[key];
          if (!number) return null;
          const [textColor, bgColor, borderColor] = color.split(" ");
          return (
            <a
              key={key}
              href={`tel:${number.replace(/[^0-9+]/g, "")}`}
              className={`flex flex-col items-center justify-center p-4 rounded-2xl border-2 gap-1 transition-all active:scale-95 ${bgColor} ${borderColor}`}
            >
              <span className="text-2xl">{emoji}</span>
              <span className={`text-2xl font-black tracking-tight ${textColor}`}>{number}</span>
              <span className={`text-xs font-semibold ${textColor} opacity-80`}>{label}</span>
            </a>
          );
        })}
      </div>

      {/* Ambassade section */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏛️</span>
          <h3 className="font-bold text-slate-800 text-sm">Ambassade de France à l'étranger</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Pour toute urgence consulaire (perte de passeport, arrestation, hospitalisation…), contactez l'ambassade ou le consulat français au {info.country}.
        </p>
        <a
          href={`https://www.diplomatie.gouv.fr/fr/services-aux-francais/preparer-son-expatriation/annuaire-des-ambassades-et-consulats-francais-a-l-etranger/`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 hover:bg-primary/10 rounded-xl px-3 py-2.5 transition-colors w-full justify-center"
        >
          🔗 Trouver l'ambassade française — diplomatie.gouv.fr
        </a>
      </div>

      {/* Health insurance reminder */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <p className="text-xs text-amber-800 font-medium flex items-start gap-2">
          <span className="text-base shrink-0">💡</span>
          <span>Pensez à emporter votre <b>Carte Européenne d'Assurance Maladie (CEAM)</b> si vous voyagez en Europe, ou votre assurance voyage à l'international.</span>
        </p>
      </div>
    </div>
  );
}
