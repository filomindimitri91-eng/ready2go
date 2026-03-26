import { useState } from "react";
import { cn } from "@/lib/utils";
import { TranslatorTab } from "./translator-tab";
import { EmergencyTab } from "./emergency-tab";
import { AssistantTab } from "./assistant-tab";

type HelpTab = "translator" | "emergency" | "assistant";

const TABS: { id: HelpTab; emoji: string; label: string }[] = [
  { id: "translator", emoji: "🎙️", label: "Traducteur" },
  { id: "emergency",  emoji: "🆘", label: "Urgences" },
  { id: "assistant",  emoji: "🤖", label: "Assistant" },
];

interface Props {
  destination: string;
  apiBase: string;
}

export function TripHelp({ destination, apiBase }: Props) {
  const [tab, setTab] = useState<HelpTab>("assistant");

  return (
    <div className="space-y-4">
      {/* Sub-tab bar */}
      <div className="bg-card border border-border/50 rounded-2xl p-1 flex gap-1 shadow">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-xl text-xs font-semibold transition-all",
              tab === t.id
                ? "bg-primary text-primary-foreground shadow"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="text-base">{t.emoji}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div>
        {tab === "translator" && <TranslatorTab destination={destination} apiBase={apiBase} />}
        {tab === "emergency"  && <EmergencyTab  destination={destination} />}
        {tab === "assistant"  && <AssistantTab  destination={destination} apiBase={apiBase} />}
      </div>
    </div>
  );
}
