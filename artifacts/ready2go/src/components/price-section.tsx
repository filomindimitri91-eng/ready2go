import { Input, Label } from "@/components/ui-elements";
import { cn } from "@/lib/utils";

export const PRICE_TYPES = [
  { value: "per_person", label: "Par personne", emoji: "👤" },
  { value: "per_adult",  label: "Par adulte",   emoji: "🧑" },
  { value: "per_group",  label: "Par groupe",   emoji: "👥" },
];

export const PRICE_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  PRICE_TYPES.map(t => [t.value, `${t.emoji} ${t.label}`])
);

interface PriceSectionProps {
  priceInput: string;
  onPriceChange: (v: string) => void;
  isFree: boolean;
  onFreeToggle: () => void;
  priceType: string;
  onPriceTypeChange: (v: string) => void;
  currency?: string;
  hideTypeSelector?: boolean;
  groupLabel?: string;
}

export function PriceSection({
  priceInput,
  onPriceChange,
  isFree,
  onFreeToggle,
  priceType,
  onPriceTypeChange,
  currency = "€",
  hideTypeSelector = false,
  groupLabel,
}: PriceSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1">
          Prix <span className="text-muted-foreground text-xs">(facultatif)</span>
        </Label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onFreeToggle}
            className={cn(
              "shrink-0 px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all",
              isFree
                ? "border-green-500 bg-green-50 text-green-700"
                : "border-border bg-background text-muted-foreground hover:border-green-400"
            )}
          >
            {isFree ? "✓ Gratuit" : "Gratuit"}
          </button>
          {!isFree && (
            <>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={priceInput}
                onChange={e => onPriceChange(e.target.value)}
                placeholder="Ex: 15"
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
            </>
          )}
        </div>
      </div>

      {!isFree && !hideTypeSelector && (
        <div>
          <Label className="mb-1">{groupLabel ?? "Type de tarif"}</Label>
          <div className="flex gap-2">
            {PRICE_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => onPriceTypeChange(t.value)}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center gap-1 py-2.5 px-1 rounded-xl border-2 transition-all text-center",
                  priceType === t.value
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40"
                )}
              >
                <span className="text-base leading-none">{t.emoji}</span>
                <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
