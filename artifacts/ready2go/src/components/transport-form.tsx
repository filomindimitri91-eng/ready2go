import React, { useState } from "react";
import { Loader2, Upload, X, Paperclip } from "lucide-react";
import { Button, Input, Label } from "@/components/ui-elements";
import { cn } from "@/lib/utils";
import { PriceSection } from "@/components/price-section";
import type { EventType } from "@workspace/api-client-react";

// ─── Static data ────────────────────────────────────────────────────────────

const TRANSPORT_TYPES = [
  { value: "plane",     label: "Avion",       emoji: "✈️" },
  { value: "train",     label: "Train",        emoji: "🚄" },
  { value: "bus",       label: "Bus",          emoji: "🚌" },
  { value: "ferry",     label: "Ferry",        emoji: "⛴️" },
  { value: "metro",     label: "Métro / Tram", emoji: "🚇" },
  { value: "carRental", label: "Location",     emoji: "🚗" },
  { value: "taxi",      label: "Taxi / VTC",   emoji: "🚕" },
  { value: "other",     label: "Autre",        emoji: "🔄" },
];

const AIRLINES = ["Air France", "easyJet", "Ryanair", "Transavia", "Vueling", "Iberia", "Lufthansa", "British Airways", "KLM", "Swiss", "Turkish Airlines", "Emirates", "Air Canada", "Delta", "United Airlines", "American Airlines", "Corsair", "La Compagnie", "TAP Air Portugal", "Norwegian", "Wizz Air", "Volotea", "Air Corsica", "HOP!", "Brussels Airlines", "Finnair", "SAS", "ITA Airways"];
const TRAIN_COMPANIES = ["SNCF", "TGV InOui", "Ouigo", "Eurostar", "Thalys", "Deutsche Bahn (ICE)", "Trenitalia", "Italo", "Renfe", "Intercités", "TER", "Ouigo España"];
const FERRY_COMPANIES = ["Corsica Ferries", "La Méridionale", "Brittany Ferries", "P&O Ferries", "Stena Line", "DFDS", "Irish Ferries", "GNV", "Balearia", "Moby Lines"];
const BUS_COMPANIES = ["FlixBus", "BlaBlaBus", "Eurolines", "OUIBUS", "iDBUS", "Linebus", "Alsa"];
const RENTAL_COMPANIES = ["Avis", "Hertz", "Europcar", "Sixt", "Budget", "Enterprise", "National", "Alamo", "Thrifty", "Dollar", "Rent a Car"];
const TAXI_APPS = ["Uber", "Bolt", "Heetch", "G7", "Taxi Bleu", "Free Now", "Snapcar", "Caocao", "Le Cab", "Marcel"];
const AIRPORTS = ["Paris - Charles de Gaulle (CDG)", "Paris - Orly (ORY)", "Lyon - Saint-Exupéry (LYS)", "Marseille - Provence (MRS)", "Nice - Côte d'Azur (NCE)", "Toulouse - Blagnac (TLS)", "Bordeaux - Mérignac (BOD)", "Nantes - Atlantique (NTE)", "Strasbourg (SXB)", "Montpellier (MPL)", "Amsterdam - Schiphol (AMS)", "London - Heathrow (LHR)", "London - Gatwick (LGW)", "Brussels - Zaventem (BRU)", "Frankfurt (FRA)", "Munich (MUC)", "Madrid - Barajas (MAD)", "Barcelona - El Prat (BCN)", "Rome - Fiumicino (FCO)", "Milan - Malpensa (MXP)", "Zurich (ZRH)", "Geneva (GVA)", "Istanbul - Atatürk (IST)", "Lisbon (LIS)", "Dublin (DUB)", "Copenhagen (CPH)", "Stockholm - Arlanda (ARN)", "Athens (ATH)", "Vienna (VIE)", "Warsaw - Chopin (WAW)", "Prague (PRG)", "Budapest (BUD)", "Dubai (DXB)", "New York - JFK (JFK)", "Los Angeles (LAX)", "Montreal (YUL)", "Toronto - Pearson (YYZ)"];
const TRAIN_STATIONS = ["Paris - Gare du Nord", "Paris - Gare de Lyon", "Paris - Montparnasse", "Paris - Gare de l'Est", "Paris - Saint-Lazare", "Paris - Gare d'Austerlitz", "Lyon - Part-Dieu", "Lyon - Perrache", "Marseille - Saint-Charles", "Nice - Ville", "Bordeaux - Saint-Jean", "Toulouse - Matabiau", "Nantes", "Rennes", "Lille - Europe", "Lille - Flandres", "Strasbourg", "Montpellier - Saint-Roch", "Perpignan", "Avignon TGV", "Aix-en-Provence TGV", "London - St Pancras International", "London - Waterloo", "Amsterdam - Centraal", "Brussels - Midi / Zuid", "Berlin - Hauptbahnhof", "Frankfurt - Hauptbahnhof", "Munich - Hauptbahnhof", "Rome - Termini", "Milan - Centrale", "Barcelona - Sants", "Madrid - Atocha", "Zurich HB", "Geneva Cornavin"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getProviderLabel(type: string) {
  return ({ plane: "Compagnie aérienne", train: "Compagnie ferroviaire", bus: "Compagnie de bus", ferry: "Compagnie maritime", metro: "Réseau / Opérateur", carRental: "Loueur", taxi: "Application / Compagnie", other: "Prestataire" } as Record<string, string>)[type] ?? "Prestataire";
}
function getProviderOptions(type: string): string[] {
  return ({ plane: AIRLINES, train: TRAIN_COMPANIES, bus: BUS_COMPANIES, ferry: FERRY_COMPANIES, carRental: RENTAL_COMPANIES, taxi: TAXI_APPS, metro: [], other: [] } as Record<string, string[]>)[type] ?? [];
}
function getDepLabel(type: string) {
  return ({ plane: "Aéroport de départ", train: "Gare de départ", bus: "Arrêt / Gare de départ", ferry: "Port de départ", metro: "Station de départ", carRental: "Lieu de prise en charge", taxi: "Lieu de prise en charge", other: "Lieu de départ" } as Record<string, string>)[type] ?? "Lieu de départ";
}
function getArrLabel(type: string) {
  return ({ plane: "Aéroport d'arrivée", train: "Gare d'arrivée", bus: "Arrêt / Gare d'arrivée", ferry: "Port d'arrivée", metro: "Station d'arrivée", carRental: "Lieu de restitution", taxi: "Destination", other: "Lieu d'arrivée" } as Record<string, string>)[type] ?? "Lieu d'arrivée";
}
function getLocationOptions(type: string): string[] {
  if (type === "plane") return AIRPORTS;
  if (type === "train") return TRAIN_STATIONS;
  return [];
}
function getVehicleNumberLabel(type: string) {
  return ({ plane: "Numéro de vol", train: "Numéro de train", bus: "Ligne / Numéro", ferry: "Numéro de traversée", metro: "Numéro / Nom de ligne", other: "Numéro / Référence" } as Record<string, string>)[type] ?? "Numéro";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border/60" />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1">{title}</span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      {children}
    </div>
  );
}

function ComboInput({ id, label, options, value, onChange, placeholder, required, optional }: {
  id: string; label: string; options: string[]; value: string;
  onChange: (v: string) => void; placeholder?: string; required?: boolean; optional?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <input
        id={id}
        list={`${id}-dl`}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="flex h-12 w-full rounded-xl border-2 border-border bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all"
      />
      {options.length > 0 && (
        <datalist id={`${id}-dl`}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      )}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function TimeInput({ label, value, onChange, required, optional }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; optional?: boolean }) {
  return (
    <div>
      <Label>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <Input type="time" value={value} onChange={e => onChange(e.target.value)} required={required} />
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder, required, optional }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean; optional?: boolean }) {
  return (
    <div>
      <Label>{label}{optional && <span className="text-muted-foreground font-normal ml-1">(opt.)</span>}</Label>
      <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}

function FileUpload({ value, onChange }: { value: { name: string; url: string } | null; onChange: (v: { name: string; url: string } | null) => void }) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange({ name: file.name, url: ev.target?.result as string });
    reader.readAsDataURL(file);
  };
  return (
    <div>
      <Label>Billet / Pièce jointe <span className="text-muted-foreground font-normal">(opt.)</span></Label>
      {value ? (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border-2 border-primary/20 rounded-xl">
          <Paperclip className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium flex-1 truncate text-foreground">{value.name}</span>
          <button type="button" onClick={() => onChange(null)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center p-5 bg-muted/40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
          <Upload className="w-5 h-5 text-muted-foreground mb-1.5" />
          <span className="text-sm text-muted-foreground text-center">PDF, image ou capture d'écran</span>
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif" className="hidden" onChange={handleFile} />
        </label>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface TransportSubmitData {
  type: EventType;
  title: string;
  date: string;
  location: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  pricePerPerson: number | null;
  priceType: string | null;
  transportData: Record<string, unknown>;
}

interface Props {
  tripDate: string;
  tripStartDate: string;
  tripEndDate: string;
  onSubmit: (data: TransportSubmitData) => void;
  isPending: boolean;
  onCancel: () => void;
}

const blank = {
  transportType: "",
  provider: "",
  vehicleNumber: "",
  departureLocation: "",
  arrivalLocation: "",
  departureTerminal: "",
  arrivalTerminal: "",
  boardingTime: "",
  departureTime: "",
  arrivalTime: "",
  departureDate: "",
  arrivalDate: "",
  seat: "",
  bookingReference: "",
  vehicleCategory: "",
  driverName: "",
  pickupDateTime: "",
  returnDateTime: "",
  notes: "",
};

export function TransportForm({ tripDate, tripStartDate, tripEndDate, onSubmit, isPending, onCancel }: Props) {
  const [d, setD] = useState({ ...blank, departureDate: tripDate });
  const [attachment, setAttachment] = useState<{ name: string; url: string } | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [isFree, setIsFree] = useState(false);
  const [priceType, setPriceType] = useState("per_person");
  const [ticketType, setTicketType] = useState<"aller_simple" | "aller_retour">("aller_simple");

  const set = (key: keyof typeof blank) => (value: string) => setD(prev => ({ ...prev, [key]: value }));

  const tt = d.transportType;
  const showVehicleNumber = tt !== "" && !["carRental", "taxi"].includes(tt);
  const showBoardingTime  = tt === "plane";
  const showDepTerminal   = ["plane"].includes(tt);
  const showArrTerminal   = ["plane"].includes(tt);
  const showDepPlatform   = tt === "train";
  const showSeat          = tt !== "" && !["carRental", "taxi"].includes(tt);
  const showBookingRef    = tt !== "" && tt !== "metro";
  const showVehicleCategory = tt === "carRental";
  const showDriverName    = tt === "taxi";
  const showPickupReturn  = tt === "carRental";
  const showTimes         = tt !== "" && !["carRental"].includes(tt);
  const requireArrival    = tt !== "" && !["taxi", "metro"].includes(tt);
  const showTicketType    = ["plane", "train", "bus", "ferry"].includes(tt);

  const locationOptions = getLocationOptions(tt);

  function buildTitle() {
    const emoji = TRANSPORT_TYPES.find(t => t.value === tt)?.emoji ?? "🚌";
    const numPart = d.vehicleNumber ? ` ${d.vehicleNumber}` : "";
    const providerPart = d.provider ? `${d.provider}${numPart}` : numPart.trim();
    const routePart = d.departureLocation && d.arrivalLocation
      ? ` · ${d.departureLocation} → ${d.arrivalLocation}`
      : d.departureLocation ? ` · ${d.departureLocation}` : "";
    return (`${emoji} ${providerPart}${routePart}`).trim() || "Transport";
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tt) return;
    const transportData: Record<string, unknown> = {
      ...d,
      ticketType: showTicketType ? ticketType : null,
      attachmentName: attachment?.name ?? null,
      attachmentUrl: attachment?.url ?? null,
    };
    const price = isFree ? 0 : (priceInput !== "" ? parseFloat(priceInput) : null);
    onSubmit({
      type: "transport" as EventType,
      title: buildTitle(),
      date: d.departureDate || tripDate,
      location: d.departureLocation || null,
      startTime: d.boardingTime || d.departureTime || null,
      endTime: d.arrivalTime || null,
      notes: d.notes || null,
      pricePerPerson: price,
      priceType: price !== null ? priceType : null,
      transportData,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Type de transport */}
      <Section title="Type de transport">
        <div className="grid grid-cols-4 gap-2">
          {TRANSPORT_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setD(prev => ({ ...blank, departureDate: prev.departureDate, transportType: t.value }))}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-3 px-1 rounded-xl border-2 transition-all text-center",
                tt === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="text-xl leading-none">{t.emoji}</span>
              <span className="text-[10px] font-semibold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>
        {!tt && <p className="text-xs text-muted-foreground text-center">Sélectionnez un type de transport pour continuer</p>}
      </Section>

      {tt && (
        <>
          {/* Date de départ */}
          <Section title="Date">
            <div>
              <Label>Date de départ</Label>
              <Input
                type="date"
                required
                min={tripStartDate}
                max={tripEndDate}
                value={d.departureDate}
                onChange={e => set("departureDate")(e.target.value)}
              />
            </div>
          </Section>

          {/* Informations transport */}
          <Section title="Informations">
            <ComboInput
              id="provider"
              label={getProviderLabel(tt)}
              options={getProviderOptions(tt)}
              value={d.provider}
              onChange={set("provider")}
              placeholder="Saisir ou choisir..."
              required
            />
            {showVehicleNumber && (
              <TextInput
                label={getVehicleNumberLabel(tt)}
                value={d.vehicleNumber}
                onChange={set("vehicleNumber")}
                placeholder="Ex: AF 1234"
              />
            )}
            {showBookingRef && (
              <TextInput
                label="Référence de réservation"
                value={d.bookingReference}
                onChange={set("bookingReference")}
                placeholder="Ex: X8J92P"
                optional
              />
            )}
            {showVehicleCategory && (
              <TextInput
                label="Catégorie de véhicule"
                value={d.vehicleCategory}
                onChange={set("vehicleCategory")}
                placeholder="Ex: Économique, SUV..."
                optional
              />
            )}
            {showDriverName && (
              <TextInput
                label="Nom du chauffeur"
                value={d.driverName}
                onChange={set("driverName")}
                placeholder="Optionnel"
                optional
              />
            )}
          </Section>

          {/* Départ */}
          <Section title="Départ">
            <ComboInput
              id="depLocation"
              label={getDepLabel(tt)}
              options={locationOptions}
              value={d.departureLocation}
              onChange={set("departureLocation")}
              placeholder="Saisir ou choisir..."
              required
            />
            {showDepTerminal && (
              <TextInput
                label="Terminal de départ"
                value={d.departureTerminal}
                onChange={set("departureTerminal")}
                placeholder="Ex: Terminal 2E"
                optional
              />
            )}
            {showDepPlatform && (
              <TextInput
                label="Voie / Quai"
                value={d.departureTerminal}
                onChange={set("departureTerminal")}
                placeholder="Ex: Voie 7"
                optional
              />
            )}
            {showTimes && (
              <FieldRow>
                {showBoardingTime && (
                  <TimeInput
                    label="Heure d'embarquement"
                    value={d.boardingTime}
                    onChange={set("boardingTime")}
                    optional
                  />
                )}
                <TimeInput
                  label="Heure de départ"
                  value={d.departureTime}
                  onChange={set("departureTime")}
                  required={!showPickupReturn}
                />
              </FieldRow>
            )}
            {showPickupReturn && (
              <div>
                <Label>Date et heure de prise en charge</Label>
                <Input
                  type="datetime-local"
                  value={d.pickupDateTime}
                  onChange={e => set("pickupDateTime")(e.target.value)}
                  required
                />
              </div>
            )}
          </Section>

          {/* Arrivée */}
          <Section title="Arrivée">
            <ComboInput
              id="arrLocation"
              label={getArrLabel(tt)}
              options={locationOptions}
              value={d.arrivalLocation}
              onChange={set("arrivalLocation")}
              placeholder="Saisir ou choisir..."
              required={requireArrival}
              optional={!requireArrival}
            />
            {showArrTerminal && (
              <TextInput
                label="Terminal d'arrivée"
                value={d.arrivalTerminal}
                onChange={set("arrivalTerminal")}
                placeholder="Ex: Terminal 1"
                optional
              />
            )}
            {showTimes && (
              <FieldRow>
                <div>
                  <Label>Date d'arrivée <span className="text-muted-foreground font-normal">(opt.)</span></Label>
                  <Input
                    type="date"
                    min={tripStartDate}
                    max={tripEndDate}
                    value={d.arrivalDate}
                    onChange={e => set("arrivalDate")(e.target.value)}
                  />
                </div>
                <TimeInput
                  label="Heure d'arrivée"
                  value={d.arrivalTime}
                  onChange={set("arrivalTime")}
                  optional
                />
              </FieldRow>
            )}
            {showPickupReturn && (
              <div>
                <Label>Date et heure de restitution</Label>
                <Input
                  type="datetime-local"
                  value={d.returnDateTime}
                  onChange={e => set("returnDateTime")(e.target.value)}
                />
              </div>
            )}
          </Section>

          {/* Siège & Billet */}
          <Section title="Siège & Billet">
            {showTicketType && (
              <div>
                <Label className="mb-1">Type de billet</Label>
                <div className="flex gap-2">
                  {[
                    { value: "aller_simple", label: "Aller simple", emoji: "→" },
                    { value: "aller_retour", label: "Aller-retour", emoji: "⇄" },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setTicketType(opt.value as "aller_simple" | "aller_retour")}
                      className={cn(
                        "flex-1 py-2 px-3 rounded-xl border-2 text-xs font-semibold transition-all",
                        ticketType === opt.value
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border bg-background text-muted-foreground hover:border-primary/40"
                      )}
                    >
                      {opt.emoji} {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showSeat && (
              <TextInput
                label={tt === "train" ? "Siège / Voiture" : tt === "ferry" ? "Cabine / Siège" : "Siège"}
                value={d.seat}
                onChange={set("seat")}
                placeholder="Ex: 12A, Voiture 7..."
                optional
              />
            )}
            <FileUpload value={attachment} onChange={setAttachment} />
          </Section>

          {/* Prix */}
          <Section title="Prix">
            <PriceSection
              priceInput={priceInput}
              onPriceChange={setPriceInput}
              isFree={isFree}
              onFreeToggle={() => { setIsFree(v => !v); if (!isFree) setPriceInput(""); }}
              priceType={tt === "carRental" ? "per_group" : priceType}
              onPriceTypeChange={setPriceType}
              hideTypeSelector={tt === "carRental"}
              groupLabel={tt === "carRental" ? "Prix total de la location (pour le groupe)" : undefined}
            />
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <div>
              <Label>Notes <span className="text-muted-foreground font-normal">(opt.)</span></Label>
              <textarea
                value={d.notes}
                onChange={e => setD(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Informations complémentaires..."
                rows={3}
                className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
              />
            </div>
          </Section>
        </>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button type="submit" disabled={isPending || !tt}>
          {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ajouter"}
        </Button>
      </div>
    </form>
  );
}
