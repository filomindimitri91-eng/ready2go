import React, { useState, useRef } from "react";
import { ExternalLink, Plus, ChevronDown, Upload, Loader2, X, CheckCircle2, FileText, AlertCircle, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { EventType } from "@workspace/api-client-react";

// ─── Partner / category data ───────────────────────────────────────────────────

interface Partner {
  key: string;
  label: string;
  subtitle: string;
  emoji: string;
  url: string;
  eventType: EventType;
  subtype?: string;
}

interface Category {
  key: string;
  label: string;
  emoji: string;
  partners: Partner[];
}

const BOOKING_CATEGORIES: Category[] = [
  {
    key: "vols",
    label: "Vols",
    emoji: "✈️",
    partners: [
      { key: "skyscanner", label: "Skyscanner", subtitle: "Comparateur de vols", emoji: "🔍", url: "https://www.skyscanner.fr/", eventType: "transport", subtype: "plane" },
      { key: "google-flights", label: "Google Flights", subtitle: "Vols pas chers", emoji: "🌐", url: "https://www.google.com/flights", eventType: "transport", subtype: "plane" },
      { key: "kayak-vols", label: "Kayak", subtitle: "Comparateur vol", emoji: "🛫", url: "https://www.kayak.fr/flights", eventType: "transport", subtype: "plane" },
      { key: "opodo", label: "Opodo", subtitle: "Billets d'avion", emoji: "🎫", url: "https://www.opodo.fr/", eventType: "transport", subtype: "plane" },
    ],
  },
  {
    key: "train-bus",
    label: "Train & Bus",
    emoji: "🚄",
    partners: [
      { key: "sncf", label: "SNCF Connect", subtitle: "Trains France & Europe", emoji: "🚄", url: "https://www.sncf-connect.com/", eventType: "transport", subtype: "train" },
      { key: "trainline", label: "Trainline", subtitle: "Trains & bus Europe", emoji: "🎟️", url: "https://www.trainline.fr/", eventType: "transport", subtype: "train" },
      { key: "eurostar", label: "Eurostar", subtitle: "Train sous la Manche", emoji: "🇬🇧", url: "https://www.eurostar.com/fr-fr", eventType: "transport", subtype: "train" },
      { key: "flixbus", label: "FlixBus", subtitle: "Bus longue distance", emoji: "🚌", url: "https://www.flixbus.fr/", eventType: "transport", subtype: "bus" },
      { key: "blablabus", label: "BlaBlaBus", subtitle: "Bus pas chers", emoji: "🚎", url: "https://www.blablacar.fr/bus", eventType: "transport", subtype: "bus" },
    ],
  },
  {
    key: "logement",
    label: "Hébergement",
    emoji: "🏨",
    partners: [
      { key: "booking", label: "Booking.com", subtitle: "Hôtels & appartements", emoji: "🏨", url: "https://www.booking.com/", eventType: "logement", subtype: "hotel" },
      { key: "airbnb", label: "Airbnb", subtitle: "Logements chez l'habitant", emoji: "🏠", url: "https://www.airbnb.fr/", eventType: "logement", subtype: "airbnb" },
      { key: "hotels-com", label: "Hotels.com", subtitle: "Hôtels avec rewards", emoji: "⭐", url: "https://fr.hotels.com/", eventType: "logement", subtype: "hotel" },
      { key: "abritel", label: "Abritel / Vrbo", subtitle: "Locations vacances", emoji: "🏡", url: "https://www.abritel.fr/", eventType: "logement", subtype: "rental" },
      { key: "hostelworld", label: "Hostelworld", subtitle: "Auberges de jeunesse", emoji: "🛏️", url: "https://www.hostelworld.com/", eventType: "logement", subtype: "hostel" },
    ],
  },
  {
    key: "voiture",
    label: "Location voiture",
    emoji: "🚗",
    partners: [
      { key: "bsp-auto", label: "BSP Auto", subtitle: "Meilleurs tarifs", emoji: "🚗", url: "https://www.bsp-auto.com/", eventType: "transport", subtype: "carRental" },
      { key: "rentalcars", label: "Rentalcars", subtitle: "Comparateur mondial", emoji: "🔑", url: "https://www.rentalcars.com/", eventType: "transport", subtype: "carRental" },
      { key: "europcar", label: "Europcar", subtitle: "Location longue durée", emoji: "🚘", url: "https://www.europcar.fr/", eventType: "transport", subtype: "carRental" },
      { key: "sixt", label: "Sixt", subtitle: "Voitures premium", emoji: "🏎️", url: "https://www.sixt.fr/", eventType: "transport", subtype: "carRental" },
    ],
  },
  {
    key: "activites",
    label: "Activités & Loisirs",
    emoji: "🎭",
    partners: [
      { key: "getyourguide", label: "GetYourGuide", subtitle: "Visites & excursions", emoji: "🎫", url: "https://www.getyourguide.fr/", eventType: "activite" },
      { key: "viator", label: "Viator", subtitle: "Expériences locales", emoji: "🗺️", url: "https://www.viator.com/fr-FR/", eventType: "activite" },
      { key: "ticketmaster", label: "Ticketmaster", subtitle: "Concerts & événements", emoji: "🎤", url: "https://www.ticketmaster.fr/", eventType: "activite", subtype: "concert" },
      { key: "skiset", label: "Skiset", subtitle: "Location ski", emoji: "⛷️", url: "https://www.skiset.com/", eventType: "activite" },
      { key: "clickandboat", label: "Click&Boat", subtitle: "Location bateaux", emoji: "⛵", url: "https://www.clickandboat.com/", eventType: "activite" },
      { key: "padi", label: "PADI Travel", subtitle: "Plongée sous-marine", emoji: "🤿", url: "https://travel.padi.com/", eventType: "activite" },
      { key: "alltrails", label: "AllTrails", subtitle: "Randonnées & sentiers", emoji: "🥾", url: "https://www.alltrails.com/", eventType: "activite" },
    ],
  },
  {
    key: "restaurants",
    label: "Restaurants",
    emoji: "🍽️",
    partners: [
      { key: "thefork", label: "TheFork", subtitle: "Réservation restaurant", emoji: "🍴", url: "https://www.thefork.fr/", eventType: "restauration" },
      { key: "opentable", label: "OpenTable", subtitle: "Réservation en ligne", emoji: "🪑", url: "https://www.opentable.fr/", eventType: "restauration" },
    ],
  },
];

// ─── BookingLinksSection ───────────────────────────────────────────────────────

export function BookingLinksSection() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const toggleCategory = (key: string) => {
    setOpenCategory(prev => (prev === key ? null : key));
  };

  return (
    <div className="mt-6">
      <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🔗</span>
            <h3 className="font-bold text-sm text-slate-700">Réserver en ligne</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Sélectionnez une catégorie, choisissez votre site partenaire et réservez.
          </p>
        </div>

        {/* Category pills */}
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {BOOKING_CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                openCategory === cat.key
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-white/70 text-foreground border-border hover:border-primary/50 hover:bg-white"
              }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${openCategory === cat.key ? "rotate-180" : ""}`}
              />
            </button>
          ))}
        </div>

        {/* Partner list for selected category */}
        <AnimatePresence>
          {openCategory && (() => {
            const cat = BOOKING_CATEGORIES.find(c => c.key === openCategory);
            if (!cat) return null;
            return (
              <motion.div
                key={openCategory}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="border-t border-border/40 overflow-hidden"
              >
                <div className="p-3 space-y-2">
                  {cat.partners.map(partner => (
                    <div
                      key={partner.key}
                      className="flex items-center justify-between gap-3 bg-white/60 rounded-xl px-3 py-2.5 border border-border/40"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-xl leading-none shrink-0">{partner.emoji}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate leading-tight">{partner.label}</p>
                          <p className="text-xs text-muted-foreground leading-tight">{partner.subtitle}</p>
                        </div>
                      </div>
                      <a
                        href={partner.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 flex items-center gap-1 text-[11px] font-semibold bg-white border border-border rounded-lg px-2.5 py-1.5 text-foreground hover:bg-muted/50 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Réserver
                      </a>
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── ImportReservationSection ─────────────────────────────────────────────────

interface ImportResult {
  eventType: EventType;
  title: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  notes?: string | null;
  pricePerPerson?: number | null;
  bookingReference?: string | null;
  providerName?: string | null;
  transportData?: Record<string, any> | null;
  lodgingData?: Record<string, any> | null;
  restaurationData?: Record<string, any> | null;
  activiteData?: Record<string, any> | null;
  summary: string;
  confidence: number;
  detected: Record<string, string>;
}

const TYPE_LABEL: Record<string, string> = {
  transport: "Transport",
  logement: "Logement",
  restauration: "Restauration",
  activite: "Activité",
  autre: "Autre",
};
const TYPE_EMOJI: Record<string, string> = {
  transport: "✈️",
  logement: "🏨",
  restauration: "🍽️",
  activite: "🎭",
  autre: "📌",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });
}

export function ImportReservationSection({
  onDirectAdd,
  tripStartDate,
}: {
  onDirectAdd: (data: any) => void;
  tripStartDate: string;
}) {
  const [mode, setMode] = useState<"file" | "email">("file");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [emailText, setEmailText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPdf = file?.type === "application/pdf";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setConfirmed(false);
    if (f.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(f));
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const fakeEvent = { target: { files: [f] } } as any;
    handleFileChange(fakeEvent);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setConfirmed(false);

    try {
      let body: any;

      if (mode === "file") {
        if (!file) { setError("Veuillez sélectionner un fichier."); setLoading(false); return; }
        const dataUrl = await fileToBase64(file);
        const base64 = dataUrl.split(",")[1];
        body = { mode: "file", imageBase64: base64, mimeType: file.type, tripStartDate };
      } else {
        if (!emailText.trim()) {
          setError("Veuillez coller le contenu de votre e-mail de confirmation.");
          setLoading(false);
          return;
        }
        body = { mode: "email", emailText: emailText.trim(), tripStartDate };
      }

      const token = typeof localStorage !== "undefined" ? localStorage.getItem("r2g_token") : null;
      const res = await fetch("/api/ai/import-reservation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error || "Erreur lors de l'analyse.");
        return;
      }

      const data: ImportResult = await res.json();
      setResult(data);
    } catch {
      setError("Erreur de connexion au serveur.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (!result) return;
    const eventData: any = {
      type: result.eventType,
      title: result.title,
      date: result.date,
      startTime: result.startTime ?? "",
      endTime: result.endTime ?? "",
      location: result.location ?? "",
      notes: result.notes ?? "",
      pricePerPerson: result.pricePerPerson ?? null,
    };
    if (result.transportData) eventData.transportData = result.transportData;
    if (result.lodgingData) eventData.lodgingData = result.lodgingData;
    if (result.restaurationData) eventData.restaurationData = result.restaurationData;
    if (result.activiteData) eventData.activiteData = result.activiteData;
    onDirectAdd(eventData);
    setConfirmed(true);
  };

  const handleReset = () => {
    setFile(null);
    setFilePreview(null);
    setEmailText("");
    setResult(null);
    setError(null);
    setConfirmed(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const canAnalyze = mode === "file" ? !!file : !!emailText.trim();

  return (
    <div className="mt-3">
      <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">📥</span>
            <h3 className="font-bold text-sm text-slate-700">Importer une réservation</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Importez un document ou collez votre e-mail — l'IA crée l'événement automatiquement.
          </p>
        </div>

        {/* Mode tabs */}
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={() => { setMode("file"); setResult(null); setError(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              mode === "file"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/70 text-foreground border-border hover:border-primary/50"
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Fichier
          </button>
          <button
            onClick={() => { setMode("email"); setResult(null); setError(null); }}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
              mode === "email"
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/70 text-foreground border-border hover:border-primary/50"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            E-mail
          </button>
        </div>

        <div className="border-t border-border/40 p-4 space-y-3">
          {/* File mode */}
          {mode === "file" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              {!file ? (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={e => e.preventDefault()}
                  className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border/60 hover:border-primary/50 rounded-xl py-8 text-muted-foreground hover:text-primary transition-colors bg-muted/20 hover:bg-primary/5"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-sm font-medium">Capture d'écran, PDF ou billet</span>
                  <span className="text-xs text-center px-4">Confirmation de réservation, e-ticket, billet…</span>
                  <span className="text-[11px] bg-muted/60 px-2 py-0.5 rounded-md">JPG · PNG · PDF · WebP · HEIC</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
                  {isPdf ? (
                    <div className="w-12 h-12 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                      <span className="text-xl">📄</span>
                    </div>
                  ) : filePreview ? (
                    <img src={filePreview} alt="Aperçu" className="w-12 h-12 rounded-lg object-cover border border-border/40 shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {isPdf ? "PDF" : "Image"} · {(file.size / 1024).toFixed(0)} Ko
                    </p>
                  </div>
                  <button onClick={handleReset} className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}

          {/* Email paste mode */}
          {mode === "email" && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                Contenu de l'e-mail de confirmation
              </label>
              <textarea
                value={emailText}
                onChange={e => setEmailText(e.target.value)}
                placeholder={"Ouvrez votre e-mail de confirmation (Booking.com, Air France, SNCF, Airbnb…),\nsélectionnez tout le texte et collez-le ici."}
                rows={7}
                className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/70 resize-none leading-relaxed"
              />
              {emailText.length > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1 text-right">{emailText.length} caractères</p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2.5 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Analyze button */}
          {!result && !confirmed && (
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze || loading}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-primary text-primary-foreground rounded-xl py-2.5 hover:opacity-90 disabled:opacity-40 transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyse en cours…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Analyser avec l'IA
                </>
              )}
            </button>
          )}

          {/* Result preview */}
          <AnimatePresence>
            {result && !confirmed && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-3"
              >
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{TYPE_EMOJI[result.eventType] ?? "📌"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold uppercase tracking-wider text-green-700 bg-green-100 px-2 py-0.5 rounded-md">
                          {TYPE_LABEL[result.eventType] ?? result.eventType}
                        </span>
                        {result.confidence >= 0.8 && (
                          <span className="text-[10px] text-green-600 font-medium">✓ Haute confiance</span>
                        )}
                      </div>
                      <p className="text-sm font-bold mt-0.5 truncate">{result.title}</p>
                    </div>
                  </div>

                  <p className="text-xs text-green-800/80 italic">{result.summary}</p>

                  {Object.keys(result.detected).length > 0 && (
                    <div className="space-y-1">
                      {Object.entries(result.detected).map(([k, v]) => (
                        <div key={k} className="flex items-start gap-2 text-xs">
                          <span className="text-green-600 font-semibold min-w-[80px] shrink-0">{k}</span>
                          <span className="text-foreground">{v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleConfirm}
                    className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-green-600 text-white rounded-xl py-2.5 hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter au programme
                  </button>
                  <button
                    onClick={handleReset}
                    className="px-4 text-sm font-semibold bg-muted text-muted-foreground rounded-xl py-2.5 hover:bg-muted/80 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            )}

            {confirmed && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 py-4 text-center"
              >
                <CheckCircle2 className="w-10 h-10 text-green-500" />
                <p className="font-semibold text-sm">Événement ajouté au programme !</p>
                <button onClick={handleReset} className="text-xs text-primary hover:underline font-medium">
                  Importer une autre réservation
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
