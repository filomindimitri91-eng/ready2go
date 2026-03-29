import { useState, useMemo, useRef, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft, ChevronDown, ChevronUp, Plus, MapPin, CalendarDays, Copy,
  Trash2, Loader2, CheckCircle2,
  Tent, Plane, Home as HomeIcon, List,
  ArrowRight, Paperclip, Clock, UtensilsCrossed, ExternalLink,
  RefreshCw, Pencil, FileDown, Mail, MessageSquare, Share2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import {
  useGetTrip,
  useDeleteTrip,
  useCreateEvent,
  useDeleteEvent,
  getGetTripQueryKey,
  getGetTripsQueryKey,
  EventType,
  Event
} from "@workspace/api-client-react";
import { Button, Card, Input, Label, Modal } from "@/components/ui-elements";
import { generateTripPDF } from "@/lib/trip-pdf";
import { TransportForm, TransportSubmitData } from "@/components/transport-form";
import { LodgingForm, LodgingSubmitData, getMapsUrl, getWazeUrl } from "@/components/lodging-form";
import { RestaurationForm, RestaurationSubmitData, RESTO_EMOJI, RESTO_LABEL } from "@/components/restauration-form";
import { ActiviteForm, ActiviteSubmitData, ACTIVITE_EMOJI, ACTIVITE_LABEL } from "@/components/activite-form";
import { TripMap, PoiClickData, MemberLocation } from "@/components/trip-map";
import type { ActiviteInitialVenue } from "@/components/activite-form";
import type { RestaurationInitialVenue } from "@/components/restauration-form";
import { TripHelp } from "@/components/help/trip-help";
import { WeatherWidget } from "@/components/weather-widget";
import { NavButtons } from "@/components/nav-buttons";
import { BudgetTab } from "@/components/budget-tab";
import { PriceSection, PRICE_TYPE_LABEL } from "@/components/price-section";
import { BookingLinksSection, ImportReservationSection } from "@/components/booking-section";
import { NewsTicker } from "@/components/news-ticker";
import logoImg from "@/assets/logo.png";

// ─── Timezone-safe date parser ────────────────────────────────────────────────
// parseISO with date-only strings treats them as UTC midnight, which causes
// off-by-one display errors in negative-UTC timezones. This constructs a local date.
function parseDateLocal(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

// ─── Event type meta ──────────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: React.ElementType; colorClass: string; label: string }> = {
  transport:    { icon: Plane,            colorClass: "text-event-transport bg-event-transport/10 border-event-transport",           label: "Transport" },
  logement:     { icon: HomeIcon,         colorClass: "text-event-logement bg-event-logement/10 border-event-logement",             label: "Logement" },
  restauration: { icon: UtensilsCrossed,  colorClass: "text-event-restauration bg-event-restauration/10 border-event-restauration", label: "Restauration" },
  activite:     { icon: Tent,             colorClass: "text-event-activite bg-event-activite/10 border-event-activite",             label: "Activité" },
  autre:        { icon: List,             colorClass: "text-event-autre bg-event-autre/10 border-event-autre",                      label: "Autre" },
  // kept for backward compat with old events
  reunion:      { icon: UtensilsCrossed,  colorClass: "text-event-restauration bg-event-restauration/10 border-event-restauration", label: "Restauration" },
};

// ─── Transport display helpers ────────────────────────────────────────────────

const TRANSPORT_EMOJI: Record<string, string> = {
  plane: "✈️", train: "🚄", bus: "🚌", ferry: "⛴️",
  metro: "🚇", carRental: "🚗", taxi: "🚕", other: "🔄",
};
const TRANSPORT_LABEL: Record<string, string> = {
  plane: "Avion", train: "Train", bus: "Bus", ferry: "Ferry",
  metro: "Métro / Tram", carRental: "Location voiture", taxi: "Taxi / VTC", other: "Transport",
};

interface TransportData {
  transportType?: string;
  provider?: string;
  vehicleNumber?: string;
  departureLocation?: string;
  arrivalLocation?: string;
  departureTerminal?: string;
  arrivalTerminal?: string;
  boardingTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  arrivalDate?: string;
  seat?: string;
  bookingReference?: string;
  vehicleCategory?: string;
  driverName?: string;
  pickupDateTime?: string;
  returnDateTime?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  notes?: string;
}

function TransportCard({ event, onDelete, onEdit }: { event: Event & { transportData?: TransportData | null }; onDelete: () => void; onEdit: () => void }) {
  const td = event.transportData as TransportData | null | undefined;
  const meta = EVENT_META.transport;
  const tt = td?.transportType ?? "";
  const emoji = TRANSPORT_EMOJI[tt] ?? "🚌";
  const label = TRANSPORT_LABEL[tt] ?? "Transport";
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <Card className={cn("overflow-hidden border-l-4", meta.colorClass.split(" ")[2])}>
      {/* Header row */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{emoji}</span>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(td?.boardingTime || td?.departureTime || td?.arrivalTime) && (
            <div className="flex items-center gap-1 text-xs font-medium bg-muted px-2 py-1 rounded-lg text-muted-foreground">
              <Clock className="w-3 h-3" />
              {td.boardingTime
                ? `Embarquement ${td.boardingTime}`
                : td?.departureTime
                  ? `${td.departureTime}${td?.arrivalTime ? ` → ${td.arrivalTime}` : ""}`
                  : ""}
            </div>
          )}
          <button
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title / provider + route */}
      <h4 className="text-base font-bold mb-2">{event.title}</h4>

      {/* Departure → Arrival */}
      {(td?.departureLocation || td?.arrivalLocation) && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {td?.departureLocation && (
            <div className="text-sm font-medium bg-muted/60 px-2.5 py-1 rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Départ</div>
              {td.departureLocation}
              {td?.departureTerminal && (
                <span className="text-xs text-muted-foreground ml-1">· {td.departureTerminal}</span>
              )}
            </div>
          )}
          {td?.departureLocation && td?.arrivalLocation && (
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          {td?.arrivalLocation && (
            <div className="text-sm font-medium bg-muted/60 px-2.5 py-1 rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Arrivée</div>
              {td.arrivalLocation}
              {td?.arrivalTerminal && (
                <span className="text-xs text-muted-foreground ml-1">· {td.arrivalTerminal}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation links — Départ & Arrivée */}
      {(td?.departureLocation || td?.arrivalLocation) && (
        <div className="flex flex-col gap-1.5 mt-3">
          {td?.departureLocation && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground w-14 shrink-0">📍 Départ</span>
              <NavButtons
                mapsUrl={getMapsUrl("", td.departureLocation, "", null, null)}
                wazeUrl={getWazeUrl("", td.departureLocation, "", null, null)}
              />
            </div>
          )}
          {td?.arrivalLocation && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground w-14 shrink-0">🏁 Arrivée</span>
              <NavButtons
                mapsUrl={getMapsUrl("", td.arrivalLocation, "", null, null)}
                wazeUrl={getWazeUrl("", td.arrivalLocation, "", null, null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Extra details row */}
      <div className="flex flex-wrap gap-2 mt-2">
        {td?.vehicleNumber && (
          <span className="text-xs bg-secondary/50 text-foreground px-2 py-0.5 rounded-md font-mono font-semibold">
            {td.vehicleNumber}
          </span>
        )}
        {td?.bookingReference && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md font-mono">
            Réf: {td.bookingReference}
          </span>
        )}
        {td?.seat && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">
            Siège {td.seat}
          </span>
        )}
        {td?.vehicleCategory && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">
            {td.vehicleCategory}
          </span>
        )}
        {td?.driverName && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">
            Chauffeur: {td.driverName}
          </span>
        )}
      </div>

      {/* Car rental pickup/return */}
      {(td?.pickupDateTime || td?.returnDateTime) && (
        <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
          {td?.pickupDateTime && <span>📍 Prise en charge: {td.pickupDateTime.replace("T", " ")}</span>}
          {td?.returnDateTime && <span>🔁 Restitution: {td.returnDateTime.replace("T", " ")}</span>}
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="text-sm text-foreground/80 mt-3 bg-secondary/30 p-3 rounded-lg border border-secondary/50">
          {event.notes}
        </p>
      )}

      {/* Attachment */}
      {td?.attachmentName && td?.attachmentUrl && (
        <div className="mt-3">
          {td.attachmentUrl.startsWith("data:image") ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
              >
                <Paperclip className="w-4 h-4" />
                {td.attachmentName}
              </button>
              {previewOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                  onClick={() => setPreviewOpen(false)}
                >
                  <img
                    src={td.attachmentUrl}
                    alt={td.attachmentName}
                    className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl"
                  />
                </div>
              )}
            </>
          ) : (
            <a
              href={td.attachmentUrl}
              download={td.attachmentName}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
            >
              <Paperclip className="w-4 h-4" />
              {td.attachmentName}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Lodging card ─────────────────────────────────────────────────────────────

const LODGING_EMOJI: Record<string, string> = {
  hotel: "🏨", airbnb: "🏠", rental: "🏡",
  camping: "⛺", hostel: "🛏️", guesthouse: "🏘️", other: "🏢",
};
const LODGING_LABEL: Record<string, string> = {
  hotel: "Hôtel", airbnb: "Airbnb", rental: "Location",
  camping: "Camping", hostel: "Auberge", guesthouse: "Chambre d'hôtes", other: "Hébergement",
};

interface LodgingData {
  lodgingType?: string;
  name?: string;
  brand?: string;
  address?: string;
  city?: string;
  country?: string;
  checkInDate?: string;
  checkInTime?: string;
  checkOutDate?: string;
  checkOutTime?: string;
  bookingProvider?: string;
  bookingReference?: string;
  roomType?: string;
  guestCount?: string | number;
  hostName?: string;
  accessCode?: string;
  accessInstructions?: string;
  phone?: string;
  email?: string;
  contactPerson?: string;
  contactPhone?: string;
  pitchNumber?: string;
  vehiclePlate?: string;
  dormType?: string;
  bedNumber?: string;
  breakfastIncluded?: boolean;
  latitude?: string | number | null;
  longitude?: string | number | null;
  attachmentName?: string;
  attachmentUrl?: string;
  notes?: string;
}

function LodgingCard({ event, onDelete, onEdit }: { event: Event & { lodgingData?: LodgingData | null }; onDelete: () => void; onEdit: () => void }) {
  const ld = event.lodgingData as LodgingData | null | undefined;
  const meta = EVENT_META.logement;
  const lt = ld?.lodgingType ?? "";
  const emoji = LODGING_EMOJI[lt] ?? "🏠";
  const label = LODGING_LABEL[lt] ?? "Hébergement";
  const [previewOpen, setPreviewOpen] = useState(false);

  const fullAddress = [ld?.address, ld?.city, ld?.country].filter(Boolean).join(", ");
  const mapsUrl = fullAddress
    ? getMapsUrl(ld?.address ?? "", ld?.city ?? "", ld?.country ?? "", ld?.latitude, ld?.longitude)
    : null;
  const wazeUrl = fullAddress
    ? getWazeUrl(ld?.address ?? "", ld?.city ?? "", ld?.country ?? "", ld?.latitude, ld?.longitude)
    : null;

  return (
    <Card className={cn("overflow-hidden border-l-4", meta.colorClass.split(" ")[2])}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{emoji}</span>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Name */}
      <h4 className="text-base font-bold mb-2">{event.title.replace(/^[^\s]+\s/, "")}</h4>

      {/* Check-in / Check-out */}
      {(ld?.checkInDate || ld?.checkOutDate) && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {ld?.checkInDate && (
            <div className="text-sm bg-muted/60 px-2.5 py-1.5 rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Arrivée</div>
              <span className="font-medium">{format(parseDateLocal(ld.checkInDate), "dd MMM", { locale: fr })}</span>
              {ld?.checkInTime && <span className="text-muted-foreground ml-1">{ld.checkInTime}</span>}
            </div>
          )}
          {ld?.checkInDate && ld?.checkOutDate && (
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          {ld?.checkOutDate && (
            <div className="text-sm bg-muted/60 px-2.5 py-1.5 rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Départ</div>
              <span className="font-medium">{format(parseDateLocal(ld.checkOutDate), "dd MMM", { locale: fr })}</span>
              {ld?.checkOutTime && <span className="text-muted-foreground ml-1">{ld.checkOutTime}</span>}
            </div>
          )}
        </div>
      )}

      {/* Address */}
      {fullAddress && (
        <p className="text-sm text-muted-foreground flex items-start gap-1 mb-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          {fullAddress}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mt-2">
        {ld?.bookingProvider && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">{ld.bookingProvider}</span>
        )}
        {ld?.bookingReference && (
          <span className="text-xs bg-secondary/50 text-foreground px-2 py-0.5 rounded-md font-mono">Réf: {ld.bookingReference}</span>
        )}
        {ld?.roomType && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">{ld.roomType}</span>
        )}
        {ld?.guestCount && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">👥 {ld.guestCount} pers.</span>
        )}
        {ld?.breakfastIncluded && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md">☕ Petit-dej inclus</span>
        )}
        {ld?.hostName && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">Hôte: {ld.hostName}</span>
        )}
        {ld?.pitchNumber && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">Empl. {ld.pitchNumber}</span>
        )}
      </div>

      {/* Access code */}
      {ld?.accessCode && (
        <p className="text-sm mt-2 flex items-center gap-2">
          <span className="text-muted-foreground">🔑</span>
          <span className="font-mono font-semibold bg-muted px-2 py-0.5 rounded">{ld.accessCode}</span>
        </p>
      )}

      {/* Access instructions */}
      {ld?.accessInstructions && (
        <p className="text-sm text-foreground/80 mt-3 bg-secondary/30 p-3 rounded-lg border border-secondary/50 whitespace-pre-line">
          {ld.accessInstructions}
        </p>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="text-sm text-foreground/80 mt-3 bg-secondary/30 p-3 rounded-lg border border-secondary/50">
          {event.notes}
        </p>
      )}

      {/* Maps buttons */}
      {(mapsUrl || wazeUrl) && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <NavButtons mapsUrl={mapsUrl} wazeUrl={wazeUrl} />
        </div>
      )}

      {/* Attachment */}
      {ld?.attachmentName && ld?.attachmentUrl && (
        <div className="mt-3">
          {ld.attachmentUrl.startsWith("data:image") ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
              >
                <Paperclip className="w-4 h-4" />
                {ld.attachmentName}
              </button>
              {previewOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                  onClick={() => setPreviewOpen(false)}
                >
                  <img src={ld.attachmentUrl} alt={ld.attachmentName} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
                </div>
              )}
            </>
          ) : (
            <a href={ld.attachmentUrl} download={ld.attachmentName}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <Paperclip className="w-4 h-4" />
              {ld.attachmentName}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Restaurant card ──────────────────────────────────────────────────────────

interface RestaurationData {
  restoType?: string;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  date?: string;
  time?: string;
  timeEnd?: string;
  guestCount?: string | number;
  bookingReference?: string;
  cuisine?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  menuUrl?: string;
  menuSummary?: string;
  notes?: string;
  avgMenuPrice?: number | null;
  priceRange?: string;
  priceLevel?: string;
  priceSource?: string;
}

interface RestaurantPriceResult {
  avgMenuPrice: number | null;
  priceRange: string;
  currency: string;
  priceLevel: string;
  source: string;
  details: string;
}

function RestaurantCard({ event, onDelete, onEdit }: { event: Event & { restaurationData?: RestaurationData | null }; onDelete: () => void; onEdit: () => void }) {
  const rd = event.restaurationData as RestaurationData | null | undefined;
  const meta = EVENT_META.restauration;
  const rt = rd?.restoType ?? "";
  const emoji = RESTO_EMOJI[rt] ?? "🍽️";
  const label = RESTO_LABEL[rt] ?? "Restauration";

  const fullAddress = [rd?.address, rd?.city, rd?.country].filter(Boolean).join(", ");
  const mapsUrl = fullAddress ? getMapsUrl(rd?.address ?? "", rd?.city ?? "", rd?.country ?? "", rd?.latitude, rd?.longitude) : null;
  const wazeUrl = fullAddress ? getWazeUrl(rd?.address ?? "", rd?.city ?? "", rd?.country ?? "", rd?.latitude, rd?.longitude) : null;

  const [aiPrice, setAiPrice] = useState<RestaurantPriceResult | null>(
    rd?.avgMenuPrice != null ? {
      avgMenuPrice: rd.avgMenuPrice,
      priceRange: rd.priceRange ?? "",
      currency: "EUR",
      priceLevel: rd.priceLevel ?? "?",
      source: rd.priceSource ?? "Estimation",
      details: "",
    } : null
  );
  const [fetchingPrice, setFetchingPrice] = useState(false);

  const fetchPrice = async () => {
    if (!rd?.name || !rd?.city) return;
    setFetchingPrice(true);
    try {
      const res = await fetch("/api/ai/restaurant-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: rd.name, city: rd.city, country: rd.country ?? "", cuisine: rd.cuisine, restoType: rt }),
      });
      if (!res.ok) throw new Error();
      const data: RestaurantPriceResult = await res.json();
      setAiPrice(data);
    } catch {
      setAiPrice({ avgMenuPrice: null, priceRange: "Non disponible", currency: "EUR", priceLevel: "?", source: "Estimation", details: "Impossible de récupérer le prix." });
    } finally {
      setFetchingPrice(false);
    }
  };

  return (
    <Card className={cn("overflow-hidden border-l-4", meta.colorClass.split(" ")[2])}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{emoji}</span>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Modifier">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Name */}
      <h4 className="text-base font-bold mb-2">{event.title.replace(/^[^\s]+\s/, "")}</h4>

      {/* Time */}
      {(rd?.time || rd?.timeEnd) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {rd.time && <span className="font-medium text-foreground">{rd.time}</span>}
          {rd.time && rd.timeEnd && <ArrowRight className="w-3 h-3" />}
          {rd.timeEnd && <span className="font-medium text-foreground">{rd.timeEnd}</span>}
        </div>
      )}

      {/* Cuisine badge */}
      {rd?.cuisine && (
        <div className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-md mb-2">
          🍴 {rd.cuisine}
        </div>
      )}

      {/* Address */}
      {fullAddress && (
        <p className="text-sm text-muted-foreground flex items-start gap-1 mb-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          {fullAddress}
        </p>
      )}

      {/* Badges */}
      <div className="flex flex-wrap gap-2 mt-1">
        {rd?.guestCount && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">👥 {rd.guestCount} pers.</span>
        )}
        {rd?.bookingReference && (
          <span className="text-xs bg-secondary/50 text-foreground px-2 py-0.5 rounded-md font-mono">Réf: {rd.bookingReference}</span>
        )}
        {rd?.phone && (
          <span className="text-xs bg-secondary/50 text-muted-foreground px-2 py-0.5 rounded-md">📞 {rd.phone}</span>
        )}
      </div>

      {/* Opening hours */}
      {rd?.openingHours && (
        <p className="text-xs text-muted-foreground mt-2 font-mono bg-muted/40 px-2 py-1 rounded-lg">
          🕐 {rd.openingHours}
        </p>
      )}

      {/* Menu summary */}
      {rd?.menuSummary && (
        <p className="text-sm text-foreground/80 mt-3 bg-amber-50/60 border border-amber-100 p-3 rounded-xl">
          {rd.menuSummary}
        </p>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="text-sm text-foreground/80 mt-3 bg-secondary/30 p-3 rounded-lg border border-secondary/50">
          {event.notes}
        </p>
      )}

      {/* Prix moyen estimé */}
      {rd?.name && rd?.city && (
        <div className="mt-3">
          {!aiPrice && !fetchingPrice && (
            <button
              type="button"
              onClick={fetchPrice}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <span>🔍</span> Prix moyen du menu
            </button>
          )}
          {fetchingPrice && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50/60 border border-amber-100 rounded-xl px-3 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span>Recherche du prix sur TripAdvisor, Google…</span>
            </div>
          )}
          {aiPrice && !fetchingPrice && (
            <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl px-3 py-2.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-base leading-none">{aiPrice.priceLevel}</span>
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      {aiPrice.avgMenuPrice != null
                        ? `~${aiPrice.avgMenuPrice} ${aiPrice.currency} / pers.`
                        : "Prix non disponible"}
                    </p>
                    {aiPrice.priceRange && (
                      <p className="text-[11px] text-amber-700/70">{aiPrice.priceRange}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchPrice}
                  title="Rafraîchir"
                  className="text-amber-500 hover:text-amber-700 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              {aiPrice.details && (
                <p className="text-[11px] text-amber-700/80 leading-snug">{aiPrice.details}</p>
              )}
              <p className="text-[10px] text-amber-500 flex items-center gap-1">
                <span>🤖</span> Source estimée : {aiPrice.source}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation + menu link row */}
      <div className="flex flex-wrap gap-2 mt-3">
        <NavButtons mapsUrl={mapsUrl} wazeUrl={wazeUrl} />
        {rd?.website && (
          <a href={rd.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-secondary/50 text-foreground border border-border hover:bg-secondary transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />Site web
          </a>
        )}
        {rd?.menuUrl && (
          <a href={rd.menuUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors">
            🍽️ Menu
          </a>
        )}
      </div>
    </Card>
  );
}

// ─── Activite card ────────────────────────────────────────────────────────────

interface ActiviteData {
  activiteType?: string;
  name?: string;
  address?: string;
  city?: string;
  country?: string;
  latitude?: string | number | null;
  longitude?: string | number | null;
  time?: string;
  timeEnd?: string;
  bookingReference?: string;
  website?: string;
  notes?: string;
  ticketName?: string | null;
  ticketUrl?: string | null;
  ticketType?: string | null;
}

function ActiviteCard({ event, onDelete, onEdit }: { event: Event & { activiteData?: ActiviteData | null }; onDelete: () => void; onEdit: () => void }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const ad = event.activiteData as ActiviteData | null | undefined;
  const meta = EVENT_META.activite;
  const at = ad?.activiteType ?? "";
  const emoji = ACTIVITE_EMOJI[at] ?? "📍";
  const label = ACTIVITE_LABEL[at] ?? "Activité";

  const fullAddress = [ad?.address, ad?.city, ad?.country].filter(Boolean).join(", ");
  const mapsUrl = fullAddress ? getMapsUrl(ad?.address ?? "", ad?.city ?? "", ad?.country ?? "", ad?.latitude, ad?.longitude) : null;
  const wazeUrl = fullAddress ? getWazeUrl(ad?.address ?? "", ad?.city ?? "", ad?.country ?? "", ad?.latitude, ad?.longitude) : null;
  const isImage = ad?.ticketType?.startsWith("image/");

  return (
    <Card className={cn("overflow-hidden border-l-4", meta.colorClass.split(" ")[2])}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{emoji}</span>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {label}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} className="text-muted-foreground hover:text-primary transition-colors p-1" title="Modifier">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors p-1" title="Supprimer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Name */}
      <h4 className="text-base font-bold mb-2">{event.title.replace(/^[^\s]+\s/, "")}</h4>

      {/* Time */}
      {(ad?.time || ad?.timeEnd) && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          {ad.time && <span className="font-medium text-foreground">{ad.time}</span>}
          {ad.time && ad.timeEnd && <ArrowRight className="w-3 h-3" />}
          {ad.timeEnd && <span className="font-medium text-foreground">{ad.timeEnd}</span>}
        </div>
      )}

      {/* Address */}
      {fullAddress && (
        <p className="text-sm text-muted-foreground flex items-start gap-1 mb-2">
          <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
          {fullAddress}
        </p>
      )}

      {/* Booking ref */}
      {ad?.bookingReference && (
        <div className="inline-flex items-center gap-1.5 text-xs bg-secondary/50 text-foreground px-2 py-0.5 rounded-md font-mono mb-2">
          🎟️ Réf: {ad.bookingReference}
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <p className="text-sm text-foreground/80 mt-2 bg-secondary/30 p-3 rounded-lg border border-secondary/50">
          {event.notes}
        </p>
      )}

      {/* Navigation + site */}
      <div className="flex flex-wrap gap-2 mt-3">
        <NavButtons mapsUrl={mapsUrl} wazeUrl={wazeUrl} />
        {ad?.website && (
          <a href={ad.website} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-secondary/50 text-foreground border border-border hover:bg-secondary transition-colors">
            <ExternalLink className="w-3.5 h-3.5" />Site web
          </a>
        )}
      </div>

      {/* Ticket attachment */}
      {ad?.ticketUrl && ad?.ticketName && (
        <div className="mt-3">
          {isImage ? (
            <>
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
              >
                <Paperclip className="w-4 h-4" />
                {ad.ticketName}
              </button>
              {previewOpen && (
                <div
                  className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
                  onClick={() => setPreviewOpen(false)}
                >
                  <img src={ad.ticketUrl} alt={ad.ticketName} className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl" />
                </div>
              )}
            </>
          ) : (
            <a href={ad.ticketUrl} download={ad.ticketName}
              className="flex items-center gap-2 text-sm text-primary font-medium hover:underline">
              <Paperclip className="w-4 h-4" />
              {ad.ticketName}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Standard event card ──────────────────────────────────────────────────────

function StandardCard({ event, onDelete, onEdit }: { event: Event; onDelete: () => void; onEdit: () => void }) {
  const meta = EVENT_META[event.type] || EVENT_META.autre;
  const Icon = meta.icon;
  return (
    <Card className={cn("overflow-hidden border-l-4", meta.colorClass.split(" ")[2])}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <div className={cn("p-1.5 rounded-md", meta.colorClass.split(" ")[1])}>
            <Icon className={cn("w-4 h-4", meta.colorClass.split(" ")[0])} />
          </div>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {meta.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(event.startTime || event.endTime) && (
            <span className="text-sm font-medium bg-muted px-2 py-1 rounded text-muted-foreground">
              {event.startTime || "?"} {event.endTime ? `- ${event.endTime}` : ""}
            </span>
          )}
          <button
            onClick={onEdit}
            className="text-muted-foreground hover:text-primary transition-colors p-1"
            title="Modifier"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive transition-colors p-1"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      <h4 className="text-lg font-bold mb-1">{event.title}</h4>
      {event.location && (
        <p className="text-sm text-muted-foreground flex items-start mt-2">
          <MapPin className="w-4 h-4 mr-1 shrink-0 mt-0.5" />
          {event.location}
        </p>
      )}
      {event.notes && (
        <p className="text-sm text-foreground/80 mt-3 bg-secondary/30 p-3 rounded-lg border border-secondary/50">
          {event.notes}
        </p>
      )}
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TripDetails() {
  const [, params] = useRoute("/voyage/:id");
  const tripId = parseInt(params?.id || "0", 10);
  const { userId, username } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"program" | "group" | "budget" | "help">("program");
  const [groupSize, setGroupSize] = useState(2);
  const [groupChildren, setGroupChildren] = useState(0);
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [addEventType, setAddEventType] = useState<EventType>("activite");
  const [addEventInitialTypes, setAddEventInitialTypes] = useState<{ transportType?: string; lodgingType?: string; activiteType?: string }>({});
  const [copied, setCopied] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [pendingPoiVenue, setPendingPoiVenue] = useState<PoiClickData | null>(null);
  const [navPoi, setNavPoi] = useState<PoiClickData | null>(null);
  const [mapSelectMode, setMapSelectMode] = useState(false);

  // ─── Travel tips (header collapsible) ────────────────────────────────────
  const [tipsOpen, setTipsOpen] = useState(false);
  const [tips, setTips] = useState<string[]>([]);
  const [tipsLoading, setTipsLoading] = useState(false);

  // ─── Member location sharing ─────────────────────────────────────────────
  const [memberLocations, setMemberLocations] = useState<MemberLocation[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const sharingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMemberLocations = async () => {
    if (!tripId) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/locations`);
      if (res.ok) setMemberLocations(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchMemberLocations();
    pollIntervalRef.current = setInterval(fetchMemberLocations, 30_000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [tripId]);

  const startSharing = () => {
    if (!navigator.geolocation) { setLocError("Géolocalisation non disponible"); return; }
    setLocError(null);
    const sendLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          fetch(`/api/trips/${tripId}/location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, username, lat: pos.coords.latitude, lng: pos.coords.longitude }),
          }).then(() => fetchMemberLocations());
        },
        () => setLocError("Impossible d'obtenir votre position"),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    };
    sendLocation();
    sharingIntervalRef.current = setInterval(sendLocation, 30_000);
    setIsSharing(true);
  };

  const stopSharing = () => {
    if (sharingIntervalRef.current) { clearInterval(sharingIntervalRef.current); sharingIntervalRef.current = null; }
    fetch(`/api/trips/${tripId}/location`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).then(() => fetchMemberLocations());
    setIsSharing(false);
  };

  useEffect(() => () => {
    if (sharingIntervalRef.current) clearInterval(sharingIntervalRef.current);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
  }, []);

  // ─── Trip Chat ────────────────────────────────────────────────────────────
  const [chatMessages, setChatMessages] = useState<{ id: number; userId: number; username: string; content: string; createdAt: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchChat = async () => {
    if (!tripId) return;
    try {
      const res = await fetch(`/api/trips/${tripId}/chat`);
      if (res.ok) setChatMessages(await res.json());
    } catch {}
  };

  useEffect(() => {
    fetchChat();
    chatPollRef.current = setInterval(fetchChat, 8_000);
    return () => { if (chatPollRef.current) clearInterval(chatPollRef.current); };
  }, [tripId]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || chatSending || !userId) return;
    setChatSending(true);
    setChatInput("");
    try {
      await fetch(`/api/trips/${tripId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username, content: text }),
      });
      await fetchChat();
    } catch {} finally {
      setChatSending(false);
    }
  };

  const handlePoiClick = (poi: PoiClickData) => {
    if (mapSelectMode) {
      setPendingPoiVenue(poi);
      setMapSelectMode(false);
      setIsAddEventOpen(true);
      return;
    }
    if (!isAddEventOpen) return;
    if (addEventType === "activite" || addEventType === "restauration" || addEventType === "logement") {
      setPendingPoiVenue(poi);
    } else {
      setNavPoi(poi);
    }
  };

  const handleRequestMapSelect = () => {
    setIsAddEventOpen(false);
    setMapSelectMode(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDirectEventAdd = (data: any) => {
    createEventMutation.mutate({ tripId, data: { ...data, creatorId: userId! } as any });
  };

  const openFromBooking = (eventType: EventType, subtype?: string) => {
    setAddEventType(eventType);
    if (eventType === "transport") {
      setAddEventInitialTypes({ transportType: subtype });
    } else if (eventType === "logement") {
      setAddEventInitialTypes({ lodgingType: subtype });
    } else if (eventType === "activite") {
      setAddEventInitialTypes({ activiteType: subtype });
    } else {
      setAddEventInitialTypes({});
    }
    setIsAddEventOpen(true);
  };

  const { data: trip, isLoading, isError } = useGetTrip(tripId, { query: { enabled: !!tripId } });

  const createEventMutation = useCreateEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
        setIsAddEventOpen(false);
      },
    },
  });

  const deleteEventMutation = useDeleteEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
      },
    },
  });

  const groupedEvents = useMemo(() => {
    if (!trip?.events) return {};
    return trip.events.reduce((acc: Record<string, Event[]>, event) => {
      if (!acc[event.date]) acc[event.date] = [];
      acc[event.date].push(event);
      return acc;
    }, {});
  }, [trip?.events]);

  const tripSummary = useMemo(() => {
    if (!trip) return "";
    const evts = (trip.events ?? []) as any[];
    const mbrs = (trip.members ?? []) as any[];
    const transports  = evts.filter(e => e.type === "transport").length;
    const logements   = evts.filter(e => e.type === "logement").length;
    const activites   = evts.filter(e => e.type === "activite").length;
    const restaur     = evts.filter(e => e.type === "restauration").length;
    const start = parseDateLocal(trip.startDate);
    const end   = parseDateLocal(trip.endDate);
    const days  = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const parts: string[] = [];
    if (transports > 0) parts.push(`✈️ ${transports} transport${transports > 1 ? "s" : ""}`);
    if (logements  > 0) parts.push(`🏨 ${logements} héberg.`);
    if (activites  > 0) parts.push(`🎭 ${activites} activité${activites > 1 ? "s" : ""}`);
    if (restaur    > 0) parts.push(`🍽️ ${restaur} resto${restaur > 1 ? "s" : ""}`);
    if (mbrs.length > 0) parts.push(`👥 ${mbrs.length} pers.`);
    parts.push(`📅 ${days}j`);
    return parts.join("  ·  ");
  }, [trip?.events, trip?.members, trip?.startDate, trip?.endDate]);

  const tripStatus = useMemo(() => {
    if (!trip) return null;
    const today = new Date();
    const start = parseDateLocal(trip.startDate);
    const end   = parseDateLocal(trip.endDate);
    if (today >= start && today <= end) return { label: "En cours", color: "bg-green-100 text-green-700" };
    const daysUntil = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    if (daysUntil > 0) return { label: `J−${daysUntil}`, color: "bg-blue-100 text-blue-700" };
    return { label: "Terminé", color: "bg-slate-100 text-slate-500" };
  }, [trip?.startDate, trip?.endDate]);

  // Fetch travel tips once when destination is known (after trip is declared)
  useEffect(() => {
    if (!trip?.destination) return;
    const token = localStorage.getItem("r2g_token");
    setTipsLoading(true);
    fetch("/api/ai/travel-tips", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ destination: trip.destination }),
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data.tips) && data.tips.length > 0) setTips(data.tips); })
      .catch(() => {})
      .finally(() => setTipsLoading(false));
  }, [trip?.destination]);

  const sortedDates = Object.keys(groupedEvents).sort();

  const handleCopyCode = () => {
    if (trip?.inviteCode) {
      navigator.clipboard.writeText(trip.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)"}}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center" style={{background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)"}}>
        <img src={logoImg} alt="Ready2Go" className="h-10 w-auto mb-6 opacity-70" />
        <h2 className="text-2xl font-bold mb-2">Voyage introuvable</h2>
        <p className="text-muted-foreground mb-6">Ce voyage n'existe pas ou vous n'y avez pas accès.</p>
        <Link href="/"><Button>Retour à l'accueil</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24 relative overflow-hidden" style={{background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)"}}>
      {/* Background blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-300/15 blur-3xl pointer-events-none" />
      {/* Header — sticky glass bar, 3-column grid */}
      <header className="sticky top-0 z-30 bg-white/55 backdrop-blur-2xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4">
          {/* Row 1 — nav */}
          <div className="h-12 grid grid-cols-3 items-center">
            <Link href="/">
              <button className="flex items-center gap-1 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors">
                <ChevronLeft className="w-4 h-4" />
                <span>Retour</span>
              </button>
            </Link>
            <div className="flex justify-center">
              <img src={logoImg} alt="Ready2Go" className="h-7 w-auto" />
            </div>
            <div className="flex justify-end">
              {tripStatus && (
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full", tripStatus.color)}>
                  {tripStatus.label}
                </span>
              )}
            </div>
          </div>
          {/* Row 2 — trip summary */}
          {tripSummary && (
            <div className="pb-1 overflow-x-auto no-scrollbar">
              <p className="text-[11px] text-slate-400 whitespace-nowrap select-none">{tripSummary}</p>
            </div>
          )}
          {/* Row 3 — travel tips (collapsible, always visible when trip loaded) */}
          {trip?.destination && (
            <div className="border-t border-white/40 pt-1 pb-1.5">
              <button
                type="button"
                onClick={() => setTipsOpen(o => !o)}
                className="flex items-center gap-1.5 w-full text-left group"
              >
                <span className="text-[10px] font-semibold text-violet-500/80 uppercase tracking-wider flex-1">
                  {tipsLoading
                    ? "💡 Chargement des conseils…"
                    : tips.length > 0
                      ? `💡 ${tips.length} conseil${tips.length > 1 ? "s" : ""} pour ${trip.destination}`
                      : `💡 Conseils voyage — ${trip.destination}`}
                </span>
                {tipsOpen
                  ? <ChevronUp className="w-3 h-3 text-slate-400 shrink-0" />
                  : <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />}
              </button>
              {tipsOpen && (
                <ul className="mt-1.5 space-y-1">
                  {tipsLoading && tips.length === 0 && (
                    <li className="text-[11px] text-slate-400 pl-1 animate-pulse">Génération des conseils en cours…</li>
                  )}
                  {tips.map((tip, i) => (
                    <li key={i} className="text-[11px] text-slate-600 leading-snug pl-1">{tip}</li>
                  ))}
                  {!tipsLoading && tips.length === 0 && (
                    <li className="text-[11px] text-slate-400 pl-1">Aucun conseil disponible pour le moment.</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Trip info card */}
      <div className="max-w-3xl mx-auto px-4 pt-4 relative z-10">
        <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm px-4 py-3 mb-4">
          <h1 className="text-xl font-bold text-slate-800 leading-snug mb-1.5">{trip.name}</h1>
          <div className="flex items-center gap-4 text-slate-500 text-sm mb-3">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-primary/70" />
              {trip.destination}
            </span>
            <span className="flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5 shrink-0 text-primary/70" />
              {format(parseDateLocal(trip.startDate), "dd MMM", { locale: fr })} – {format(parseDateLocal(trip.endDate), "dd MMM yy", { locale: fr })}
            </span>
          </div>
          {/* Groupe counter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Groupe</span>
            <div className="flex items-center gap-1.5 bg-slate-100/80 rounded-xl px-2.5 py-1">
              <button type="button" onClick={() => setGroupSize(n => Math.max(1, n - 1))} className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors">−</button>
              <span className="text-sm font-bold w-5 text-center text-slate-700">{groupSize}</span>
              <button type="button" onClick={() => setGroupSize(n => Math.min(50, n + 1))} className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors">+</button>
              <span className="text-[11px] text-slate-400 ml-1">adulte{groupSize > 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-100/80 rounded-xl px-2.5 py-1">
              <button type="button" onClick={() => setGroupChildren(n => Math.max(0, n - 1))} className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors">−</button>
              <span className="text-sm font-bold w-5 text-center text-slate-700">{groupChildren}</span>
              <button type="button" onClick={() => setGroupChildren(n => Math.min(20, n + 1))} className="w-5 h-5 flex items-center justify-center rounded-full bg-white border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-50 transition-colors">+</button>
              <span className="text-[11px] text-slate-400 ml-1">enfant{groupChildren > 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Interactive map ─ own section below trip info card ─────────── */}
      <div className="max-w-3xl mx-auto px-4 mb-6 relative z-20">
        {/* Weather widget */}
        <div className="mb-2">
          <WeatherWidget
            destination={trip.destination}
            startDate={trip.startDate}
            endDate={trip.endDate}
          />
        </div>
        <TripMap
          key={(trip.events as any[])?.map((e: any) => e.id).join(",") || "empty"}
          events={trip.events as any[]}
          destination={trip.destination}
          isAddingEvent={isAddEventOpen}
          mapSelectMode={mapSelectMode}
          activeEventType={addEventType}
          focusedEventId={focusedEventId}
          onPoiClick={handlePoiClick}
          memberLocations={memberLocations}
          myUserId={userId ?? undefined}
        />
        {focusedEventId && (
          <button
            onClick={() => setFocusedEventId(null)}
            className="absolute top-2 right-4 z-30 flex items-center gap-1 bg-white/90 hover:bg-white text-xs font-semibold text-slate-700 px-2.5 py-1 rounded-full shadow border border-white/50 transition-all"
          >
            <RefreshCw className="w-3 h-3" /> Reprendre le tour
          </button>
        )}
      </div>

      <main className="max-w-3xl mx-auto px-4 relative z-10">
        {/* Tabs */}
        <div className="bg-white/60 backdrop-blur-xl p-1 rounded-2xl shadow-md shadow-blue-900/[0.07] border border-white/70 flex gap-0.5 mb-6 overflow-x-auto">
          {([
            { id: "program",  emoji: "📅", label: "Programme" },
            { id: "group",    emoji: "👥", label: "Groupe" },
            { id: "budget",   emoji: "💰", label: "Budget" },
            { id: "help",     emoji: "🤖", label: "Assistant" },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 min-w-[60px] flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl text-[11px] font-semibold transition-all whitespace-nowrap",
                activeTab === tab.id ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-sm">{tab.emoji}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "program" ? (
            <div className="space-y-8">
              {sortedDates.length === 0 ? (
                <div className="text-center py-16 bg-white/60 backdrop-blur-xl border border-dashed border-white/80 rounded-3xl shadow-sm">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="w-8 h-8 text-blue-300" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Programme vide</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Commencez à ajouter des activités, transports ou logements à votre voyage.
                  </p>
                  <BookingLinksSection />
                  <ImportReservationSection
                    onDirectAdd={handleDirectEventAdd}
                    tripStartDate={trip.startDate}
                  />
                </div>
              ) : (
                <>
                {sortedDates.map((date) => (
                  <div key={date}>
                    <h3 className="sticky top-16 z-20 py-2 bg-white/70 backdrop-blur-md text-base font-bold text-slate-700 border-b border-white/60 mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
                        {format(parseDateLocal(date), "dd")}
                      </span>
                      {format(parseDateLocal(date), "EEEE d MMMM", { locale: fr })}
                    </h3>
                    <div className="space-y-4 pl-4 border-l-2 border-border/50 ml-4">
                      {groupedEvents[date].map((event) => {
                        const meta = EVENT_META[event.type] || EVENT_META.autre;
                        const colorParts = meta.colorClass.split(" ");
                        const dotBg = colorParts[0].replace("text-", "bg-");
                        return (
                          <div key={event.id} className="relative pl-6 group">
                            <button
                              onClick={() => {
                                setFocusedEventId(focusedEventId === event.id ? null : event.id);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              title="Voir sur la carte"
                              className={cn(
                                "absolute -left-[11px] top-4 w-5 h-5 rounded-full border-4 border-background transition-all",
                                colorParts[1], dotBg,
                                focusedEventId === event.id ? "scale-125 ring-2 ring-offset-1 ring-primary" : "hover:scale-110"
                              )}
                            />
                            {event.type === "transport" ? (
                              <TransportCard
                                event={event as any}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                                onEdit={() => setEditingEvent(event)}
                              />
                            ) : event.type === "logement" ? (
                              <LodgingCard
                                event={event as any}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                                onEdit={() => setEditingEvent(event)}
                              />
                            ) : (event.type === "restauration" || event.type === "reunion") ? (
                              <RestaurantCard
                                event={event as any}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                                onEdit={() => setEditingEvent(event)}
                              />
                            ) : event.type === "activite" ? (
                              <ActiviteCard
                                event={event as any}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                                onEdit={() => setEditingEvent(event)}
                              />
                            ) : (
                              <StandardCard
                                event={event}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                                onEdit={() => setEditingEvent(event)}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <BookingLinksSection />
                <ImportReservationSection
                  onDirectAdd={handleDirectEventAdd}
                  tripStartDate={trip.startDate}
                />
                </>
              )}
              {/* News ticker — bottom of programme tab */}
              <NewsTicker
                destination={trip.destination}
                events={(trip.events ?? []) as any[]}
              />
            </div>
          ) : activeTab === "group" ? (
            <div className="space-y-5">
              {/* Invite Code */}
              <div className="bg-blue-50/70 backdrop-blur-md border border-blue-100/80 rounded-2xl px-4 py-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Code d'invitation</p>
                    <p className="text-2xl font-mono font-bold tracking-widest text-foreground mt-0.5">{trip.inviteCode}</p>
                  </div>
                  <button
                    onClick={handleCopyCode}
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
                {/* Share row */}
                <div className="border-t border-blue-100/60 pt-2.5 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      const siteUrl = window.location.origin;
                      const text = `Rejoins notre voyage "${trip.name}" sur Ready2Go !\nCode d'invitation : ${trip.inviteCode}\n${siteUrl}`;
                      window.open(`mailto:?subject=Invitation voyage ${trip.name}&body=${encodeURIComponent(text)}`);
                    }}
                    className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 bg-white/70 hover:bg-white rounded-xl py-2 border border-blue-100/80 transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    E-mail
                  </button>
                  <button
                    onClick={() => {
                      const siteUrl = window.location.origin;
                      const text = `Rejoins notre voyage sur Ready2Go ! Code : ${trip.inviteCode} — ${siteUrl}`;
                      window.open(`sms:?&body=${encodeURIComponent(text)}`);
                    }}
                    className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 bg-white/70 hover:bg-white rounded-xl py-2 border border-blue-100/80 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    SMS
                  </button>
                  <button
                    onClick={async () => {
                      const siteUrl = window.location.origin;
                      const text = `Rejoins notre voyage "${trip.name}" !\nCode : ${trip.inviteCode}\n${siteUrl}`;
                      if (navigator.share) {
                        await navigator.share({ title: `Voyage ${trip.name}`, text }).catch(() => {});
                      } else {
                        navigator.clipboard.writeText(text).catch(() => {});
                      }
                    }}
                    className="flex flex-col items-center gap-1 text-xs font-medium text-blue-600 bg-white/70 hover:bg-white rounded-xl py-2 border border-blue-100/80 transition-colors"
                  >
                    <Share2 className="w-4 h-4" />
                    Partager
                  </button>
                </div>
              </div>

              {/* Location sharing */}
              <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">📍 Position en direct</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {memberLocations.length > 0
                        ? `${memberLocations.length} membre${memberLocations.length > 1 ? "s" : ""} visible${memberLocations.length > 1 ? "s" : ""} sur la carte`
                        : "Aucune position partagée"}
                    </p>
                  </div>
                  <button
                    onClick={isSharing ? stopSharing : startSharing}
                    className={`shrink-0 flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
                      isSharing
                        ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {isSharing ? "⏹ Arrêter" : "📡 Partager ma position"}
                  </button>
                </div>
                {locError && <p className="text-xs text-red-500">{locError}</p>}
                {memberLocations.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1 border-t border-border/40">
                    {memberLocations.map((loc) => (
                      <span key={loc.userId} className="flex items-center gap-1.5 text-xs bg-secondary/60 rounded-lg px-2.5 py-1">
                        <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                        {loc.username}{loc.userId === userId ? " (moi)" : ""}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Members */}
              <div>
                <p className="text-sm font-semibold text-muted-foreground mb-2">Participants ({trip.members.length})</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {trip.members.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3 bg-white/65 backdrop-blur-md rounded-xl border border-white/70">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0">
                        {member.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{member.username} {member.userId === trip.creatorId && "👑"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(member.joinedAt), "dd MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Group Chat */}
              <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border/50 flex items-center gap-2">
                  <span className="text-base">💬</span>
                  <p className="font-semibold text-sm">Tchat du groupe</p>
                </div>
                <div className="h-56 overflow-y-auto p-3 space-y-2 flex flex-col">
                  {chatMessages.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-muted-foreground">Aucun message — soyez le premier à écrire !</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => {
                    const isMe = msg.userId === userId;
                    return (
                      <div key={msg.id} className={cn("flex flex-col max-w-[80%]", isMe ? "self-end items-end" : "self-start items-start")}>
                        {!isMe && <p className="text-[10px] font-semibold text-muted-foreground mb-0.5 px-1">{msg.username}</p>}
                        <div className={cn("px-3 py-2 rounded-2xl text-sm", isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm")}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatBottomRef} />
                </div>
                <div className="px-3 py-2 border-t border-border/50 flex gap-2 items-center">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="Écrire un message…"
                    className="flex-1 text-sm border border-border rounded-xl px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                    disabled={chatSending}
                  />
                  <button
                    onClick={sendChatMessage}
                    disabled={!chatInput.trim() || chatSending}
                    className="w-9 h-9 bg-primary text-primary-foreground rounded-xl flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                  >
                    {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* ── Exporter PDF ─────────────────────────────────────────── */}
              <div className="bg-card border border-border/50 rounded-2xl p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-sm flex items-center gap-2">
                      <FileDown className="w-4 h-4 text-primary" />
                      Exporter le récapitulatif
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Téléchargez un PDF avec les événements, adresses, budget et participants.
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!trip) return;
                      setPdfGenerating(true);
                      await new Promise(r => setTimeout(r, 50));
                      try {
                        generateTripPDF(
                          {
                            name: trip.name,
                            destination: trip.destination,
                            startDate: trip.startDate,
                            endDate: trip.endDate,
                            inviteCode: trip.inviteCode,
                            members: trip.members,
                            events: (trip.events ?? []) as Parameters<typeof generateTripPDF>[0]["events"],
                          },
                          groupSize,
                          groupChildren
                        );
                      } finally {
                        setPdfGenerating(false);
                      }
                    }}
                    disabled={pdfGenerating}
                    className="shrink-0 flex items-center gap-2 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 px-4 py-2 rounded-xl transition-colors"
                  >
                    {pdfGenerating
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération…</>
                      : <><FileDown className="w-4 h-4" /> Télécharger PDF</>
                    }
                  </button>
                </div>
              </div>
            </div>

          ) : activeTab === "budget" ? (
            <BudgetTab
              tripId={tripId}
              destination={trip.destination}
              startDate={trip.startDate}
              endDate={trip.endDate}
              events={(trip.events as any[])?.map((e: any) => ({
                type: e.type,
                title: e.title,
                pricePerPerson: e.pricePerPerson ?? null,
                priceType: e.priceType ?? null,
                extraData: e.transportData ?? e.logementData ?? undefined,
              })) ?? []}
              adults={groupSize}
              children={groupChildren}
            />

          ) : (
            <TripHelp destination={trip.destination} apiBase="" />
          )}
        </motion.div>
      </main>

      {/* FAB */}
      {activeTab === "program" && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsAddEventOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/40 hover:shadow-xl transition-shadow z-40"
        >
          <Plus className="w-7 h-7" />
        </motion.button>
      )}

      {/* Navigation POI modal — Maps/Waze for non-venue event types */}
      {navPoi && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setNavPoi(null)}>
          <div className="bg-card w-full max-w-sm mx-4 mb-6 rounded-2xl p-5 shadow-2xl border border-border/50" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{navPoi.emoji}</span>
              <div>
                <p className="font-bold leading-tight">{navPoi.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Ouvrir l'itinéraire vers ce lieu</p>
              </div>
            </div>
            <div className="flex gap-3">
              <NavButtons
                mapsUrl={getMapsUrl("", navPoi.name, "", String(navPoi.lat), String(navPoi.lon))}
                wazeUrl={getWazeUrl("", navPoi.name, "", String(navPoi.lat), String(navPoi.lon))}
                size="lg"
                onClick={() => setNavPoi(null)}
              />
            </div>
            <button onClick={() => setNavPoi(null)} className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground transition">Fermer</button>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => { setIsAddEventOpen(false); setPendingPoiVenue(null); setAddEventInitialTypes({}); }}
        onAdd={(data: any) => createEventMutation.mutate({ tripId, data: { ...data, creatorId: userId! } as any })}
        isPending={createEventMutation.isPending}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
        selectedType={addEventType}
        onTypeChange={setAddEventType}
        pendingPoiVenue={pendingPoiVenue}
        onPoiVenueConsumed={() => setPendingPoiVenue(null)}
        onMapSelectRequest={handleRequestMapSelect}
        initialTransportType={addEventInitialTypes.transportType}
        initialLodgingType={addEventInitialTypes.lodgingType}
        initialActiviteType={addEventInitialTypes.activiteType}
      />

      {editingEvent && (
        <EditEventModal
          event={editingEvent}
          tripId={tripId}
          onClose={() => setEditingEvent(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: getGetTripQueryKey({ tripId }) });
            setEditingEvent(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({ isOpen, onClose, onAdd, isPending, tripStartDate, tripEndDate, selectedType, onTypeChange, pendingPoiVenue, onPoiVenueConsumed, onMapSelectRequest, initialTransportType, initialLodgingType, initialActiviteType }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: any) => void;
  isPending: boolean;
  tripStartDate: string;
  tripEndDate: string;
  selectedType: EventType;
  onTypeChange: (t: EventType) => void;
  pendingPoiVenue?: PoiClickData | null;
  onPoiVenueConsumed?: () => void;
  onMapSelectRequest?: () => void;
  initialTransportType?: string;
  initialLodgingType?: string;
  initialActiviteType?: string;
}) {
  const [formData, setFormData] = useState({
    title: "",
    date: tripStartDate,
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });
  const [simplePriceInput, setSimplePriceInput] = useState("");
  const [simpleIsFree, setSimpleIsFree] = useState(false);
  const [simplePriceType, setSimplePriceType] = useState("per_person");

  const handleSimpleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = simpleIsFree ? 0 : (simplePriceInput !== "" ? parseFloat(simplePriceInput) : null);
    onAdd({ type: selectedType, ...formData, pricePerPerson: price, priceType: price !== null ? simplePriceType : null });
  };

  const handleTransportSubmit = (data: TransportSubmitData) => {
    onAdd(data);
  };

  const handleLodgingSubmit = (data: LodgingSubmitData) => {
    onAdd(data);
  };

  const handleRestaurationSubmit = (data: RestaurationSubmitData) => {
    onAdd(data);
  };

  const handleActiviteSubmit = (data: ActiviteSubmitData) => {
    onAdd(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter au programme">
      {/* Type selector */}
      <div className="mb-5">
        <Label>Type d'événement</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(EVENT_META).filter(([key]) => key !== "reunion").map(([key, meta]) => {
            const Icon = meta.icon;
            const isSelected = selectedType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onTypeChange(key as EventType)}
                className={cn(
                  "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all",
                  isSelected
                    ? cn("border-primary bg-primary/5", meta.colorClass.split(" ")[0])
                    : "border-border bg-background text-muted-foreground hover:border-primary/50"
                )}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-semibold">{meta.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Specialised forms */}
      {/* Pending POI venue flash banner */}
      {pendingPoiVenue && (selectedType === "activite" || selectedType === "restauration") && (
        <div className="mb-3 flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-3 py-2 text-xs font-medium">
          <span className="text-base">{pendingPoiVenue.emoji}</span>
          <span className="flex-1 truncate"><b>{pendingPoiVenue.name}</b> importé depuis la carte ✓</span>
          <button onClick={onPoiVenueConsumed} className="text-blue-600 hover:text-blue-800 font-bold ml-1">✕</button>
        </div>
      )}

      {selectedType === "transport" ? (
        <TransportForm
          tripDate={tripStartDate}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onSubmit={handleTransportSubmit}
          isPending={isPending}
          onCancel={onClose}
          initialTransportType={initialTransportType}
        />
      ) : selectedType === "logement" ? (
        <LodgingForm
          tripDate={tripStartDate}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onSubmit={handleLodgingSubmit}
          isPending={isPending}
          onCancel={onClose}
          initialLodgingType={initialLodgingType}
        />
      ) : selectedType === "restauration" ? (
        <RestaurationForm
          tripDate={tripStartDate}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onSubmit={handleRestaurationSubmit}
          isPending={isPending}
          onCancel={onClose}
          onRequestMapSelect={onMapSelectRequest}
          initialVenue={pendingPoiVenue ? {
            name: pendingPoiVenue.name,
            lat: pendingPoiVenue.lat,
            lon: pendingPoiVenue.lon,
            address: pendingPoiVenue.address,
            tags: pendingPoiVenue.tags,
          } as RestaurationInitialVenue : null}
        />
      ) : selectedType === "activite" ? (
        <ActiviteForm
          tripDate={tripStartDate}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onSubmit={handleActiviteSubmit}
          isPending={isPending}
          onCancel={onClose}
          onRequestMapSelect={onMapSelectRequest}
          initialActiviteType={initialActiviteType}
          initialVenue={pendingPoiVenue ? {
            name: pendingPoiVenue.name,
            lat: pendingPoiVenue.lat,
            lon: pendingPoiVenue.lon,
            address: pendingPoiVenue.address,
            tags: pendingPoiVenue.tags,
          } as ActiviteInitialVenue : null}
        />
      ) : (
        /* Simple form for other types */
        <form onSubmit={handleSimpleSubmit} className="space-y-4">
          <div>
            <Label>Titre</Label>
            <Input
              required
              placeholder="Ex: Visite du musée..."
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                required
                min={tripStartDate}
                max={tripEndDate}
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Début (opt.)</Label>
                <Input
                  type="time"
                  value={formData.startTime}
                  onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                />
              </div>
              <div>
                <Label>Fin (opt.)</Label>
                <Input
                  type="time"
                  value={formData.endTime}
                  onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div>
            <Label>Lieu (optionnel)</Label>
            <Input
              placeholder="Ex: 12 Rue de la Paix"
              value={formData.location}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          <div>
            <Label>Notes (optionnel)</Label>
            <Input
              placeholder="Penser à prendre les billets..."
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <PriceSection
            priceInput={simplePriceInput}
            onPriceChange={setSimplePriceInput}
            isFree={simpleIsFree}
            onFreeToggle={() => { setSimpleIsFree(v => !v); if (!simpleIsFree) setSimplePriceInput(""); }}
            priceType={simplePriceType}
            onPriceTypeChange={setSimplePriceType}
          />

          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ajouter"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// ─── Edit Event Modal ─────────────────────────────────────────────────────────

function EditEventModal({ event, tripId, onClose, onSuccess }: {
  event: Event;
  tripId: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const meta = EVENT_META[event.type] || EVENT_META.autre;
  const [title, setTitle] = useState(event.title);
  const [date, setDate] = useState(event.date ?? "");
  const [startTime, setStartTime] = useState(event.startTime ?? "");
  const [endTime, setEndTime] = useState(event.endTime ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [priceInput, setPriceInput] = useState(
    event.pricePerPerson != null && event.pricePerPerson > 0 ? String(event.pricePerPerson) : ""
  );
  const [isFree, setIsFree] = useState(event.pricePerPerson === 0);
  const [priceType, setPriceType] = useState((event as any).priceType ?? "per_person");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);
    const price = isFree ? 0 : (priceInput !== "" ? parseFloat(priceInput) : null);
    try {
      const res = await fetch(`/api/trips/${tripId}/events/${event.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || event.title,
          date: date || event.date,
          startTime: startTime || null,
          endTime: endTime || null,
          location: location || null,
          notes: notes || null,
          pricePerPerson: price,
          priceType: price !== null ? priceType : null,
        }),
      });
      if (!res.ok) throw new Error("Erreur lors de la modification");
      onSuccess();
    } catch {
      setError("Impossible de modifier l'événement. Veuillez réessayer.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Modifier l'événement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className={cn("p-1.5 rounded-md", meta.colorClass.split(" ")[1])}>
            <meta.icon className={cn("w-4 h-4", meta.colorClass.split(" ")[0])} />
          </div>
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.colorClass.split(" ")[0])}>
            {meta.label}
          </span>
        </div>

        <div>
          <Label className="mb-1">Titre</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de l'événement" required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1">Date</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1">Début</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1">Fin</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        <div>
          <Label className="mb-1">Lieu <span className="text-muted-foreground text-xs">(facultatif)</span></Label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Paris, France" />
        </div>

        <div>
          <Label className="mb-1">Notes <span className="text-muted-foreground text-xs">(facultatif)</span></Label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Informations complémentaires..."
            className="flex w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all resize-none"
          />
        </div>

        <PriceSection
          priceInput={priceInput}
          onPriceChange={setPriceInput}
          isFree={isFree}
          onFreeToggle={() => { setIsFree(v => !v); if (!isFree) setPriceInput(""); }}
          priceType={priceType}
          onPriceTypeChange={setPriceType}
        />

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

