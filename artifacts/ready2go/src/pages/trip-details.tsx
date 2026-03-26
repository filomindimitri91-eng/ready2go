import { useState, useMemo } from "react";
import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft, Plus, MapPin, CalendarDays, Copy,
  Trash2, Loader2, CheckCircle2,
  Tent, Plane, Home as HomeIcon, Users as UsersIcon, List,
  ArrowRight, Paperclip, Clock
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
import { TransportForm, TransportSubmitData } from "@/components/transport-form";

// ─── Event type meta ──────────────────────────────────────────────────────────

const EVENT_META: Record<string, { icon: React.ElementType; colorClass: string; label: string }> = {
  activite:  { icon: Tent,      colorClass: "text-event-activite bg-event-activite/10 border-event-activite",   label: "Activité" },
  transport: { icon: Plane,     colorClass: "text-event-transport bg-event-transport/10 border-event-transport", label: "Transport" },
  logement:  { icon: HomeIcon,  colorClass: "text-event-logement bg-event-logement/10 border-event-logement",   label: "Logement" },
  reunion:   { icon: UsersIcon, colorClass: "text-event-reunion bg-event-reunion/10 border-event-reunion",       label: "Réunion" },
  autre:     { icon: List,      colorClass: "text-event-autre bg-event-autre/10 border-event-autre",             label: "Autre" },
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

function TransportCard({ event, onDelete }: { event: Event & { transportData?: TransportData | null }; onDelete: () => void }) {
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

// ─── Standard event card ──────────────────────────────────────────────────────

function StandardCard({ event, onDelete }: { event: Event; onDelete: () => void }) {
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
  const { userId } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"program" | "group">("program");
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [copied, setCopied] = useState(false);

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h2 className="text-2xl font-bold mb-2">Voyage introuvable</h2>
        <p className="text-muted-foreground mb-6">Ce voyage n'existe pas ou vous n'y avez pas accès.</p>
        <Link href="/"><Button>Retour à l'accueil</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="bg-primary text-primary-foreground pt-12 pb-20 px-4 rounded-b-[2.5rem] shadow-xl relative">
        <div className="max-w-3xl mx-auto">
          <Link href="/">
            <button className="flex items-center text-primary-foreground/80 hover:text-white mb-6 transition-colors">
              <ChevronLeft className="w-5 h-5 mr-1" />
              Retour
            </button>
          </Link>
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-4xl font-extrabold mb-2 leading-tight">{trip.name}</h1>
              <div className="flex items-center opacity-90 text-lg mb-1">
                <MapPin className="w-5 h-5 mr-2" />
                {trip.destination}
              </div>
              <div className="flex items-center opacity-90">
                <CalendarDays className="w-5 h-5 mr-2" />
                {format(parseISO(trip.startDate), "dd MMM", { locale: fr })} - {format(parseISO(trip.endDate), "dd MMM yyyy", { locale: fr })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-10 relative z-10">
        {/* Tabs */}
        <div className="bg-card p-1.5 rounded-2xl shadow-lg border border-border/50 flex mb-8">
          <button
            onClick={() => setActiveTab("program")}
            className={cn(
              "flex-1 py-3 text-sm font-semibold rounded-xl transition-all",
              activeTab === "program" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Programme
          </button>
          <button
            onClick={() => setActiveTab("group")}
            className={cn(
              "flex-1 py-3 text-sm font-semibold rounded-xl transition-all",
              activeTab === "group" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Groupe & Infos
          </button>
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
                <div className="text-center py-16 bg-card border border-dashed rounded-3xl">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <CalendarDays className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Programme vide</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    Commencez à ajouter des activités, transports ou logements à votre voyage.
                  </p>
                </div>
              ) : (
                sortedDates.map((date) => (
                  <div key={date}>
                    <h3 className="sticky top-16 z-20 py-2 bg-background/95 backdrop-blur-md text-lg font-bold text-foreground border-b border-border/50 mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-sm">
                        {format(parseISO(date), "dd")}
                      </span>
                      {format(parseISO(date), "EEEE d MMMM", { locale: fr })}
                    </h3>
                    <div className="space-y-4 pl-4 border-l-2 border-border/50 ml-4">
                      {groupedEvents[date].map((event) => {
                        const meta = EVENT_META[event.type] || EVENT_META.autre;
                        const colorParts = meta.colorClass.split(" ");
                        const dotBg = colorParts[0].replace("text-", "bg-");
                        return (
                          <div key={event.id} className="relative pl-6">
                            <div className={cn("absolute -left-[11px] top-4 w-5 h-5 rounded-full border-4 border-background", colorParts[1], dotBg)} />
                            {event.type === "transport" ? (
                              <TransportCard
                                event={event as any}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                              />
                            ) : (
                              <StandardCard
                                event={event}
                                onDelete={() => deleteEventMutation.mutate({ tripId, eventId: event.id })}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Invite Code */}
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-primary uppercase tracking-wider mb-1">Code d'invitation</h3>
                  <p className="text-muted-foreground text-sm">Partagez ce code pour inviter des amis.</p>
                </div>
                <button
                  onClick={handleCopyCode}
                  className="flex items-center gap-3 bg-background border border-primary/20 px-4 py-2 rounded-xl hover:shadow-md transition-all group"
                >
                  <span className="text-2xl font-mono font-bold tracking-widest text-foreground group-hover:text-primary transition-colors">
                    {trip.inviteCode}
                  </span>
                  {copied
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    : <Copy className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  }
                </button>
              </Card>

              {/* Members */}
              <h3 className="text-lg font-bold text-foreground">Participants ({trip.members.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trip.members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent text-white flex items-center justify-center font-bold shadow-sm">
                      {member.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold">{member.username} {member.userId === trip.creatorId && "👑"}</p>
                      <p className="text-xs text-muted-foreground">
                        A rejoint le {format(parseISO(member.joinedAt), "dd MMM", { locale: fr })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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

      {/* Add Event Modal */}
      <AddEventModal
        isOpen={isAddEventOpen}
        onClose={() => setIsAddEventOpen(false)}
        onAdd={(data: any) => createEventMutation.mutate({ tripId, data: { ...data, creatorId: userId! } as any })}
        isPending={createEventMutation.isPending}
        tripStartDate={trip.startDate}
        tripEndDate={trip.endDate}
      />
    </div>
  );
}

// ─── Add Event Modal ──────────────────────────────────────────────────────────

function AddEventModal({ isOpen, onClose, onAdd, isPending, tripStartDate, tripEndDate }: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: any) => void;
  isPending: boolean;
  tripStartDate: string;
  tripEndDate: string;
}) {
  const [selectedType, setSelectedType] = useState<EventType>("activite");
  const [formData, setFormData] = useState({
    title: "",
    date: tripStartDate,
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  });

  const handleSimpleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({ type: selectedType, ...formData });
  };

  const handleTransportSubmit = (data: TransportSubmitData) => {
    onAdd(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ajouter au programme">
      {/* Type selector */}
      <div className="mb-5">
        <Label>Type d'événement</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(EVENT_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const isSelected = selectedType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedType(key as EventType)}
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

      {/* Transport form */}
      {selectedType === "transport" ? (
        <TransportForm
          tripDate={tripStartDate}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          onSubmit={handleTransportSubmit}
          isPending={isPending}
          onCancel={onClose}
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
