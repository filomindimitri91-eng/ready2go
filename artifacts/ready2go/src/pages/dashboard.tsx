import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Users, CalendarDays, MapPin, LogOut, Loader2, Compass, Plane, QrCode } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import {
  useGetTrips,
  useCreateTrip,
  useJoinTrip,
  getGetTripsQueryKey
} from "@workspace/api-client-react";
import { Button, Input, Label, Modal } from "@/components/ui-elements";
import logoImg from "@/assets/logo.png";

// ─── Destination image ───────────────────────────────────────────────────────

function useDestinationImage(destination: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    const city = destination.split(",")[0].trim();
    const encoded = encodeURIComponent(city);
    const tryWiki = async (lang: string): Promise<string | null> => {
      try {
        const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`, { headers: { "Accept": "application/json" } });
        if (!res.ok) return null;
        const data = await res.json();
        return data?.originalimage?.source ?? data?.thumbnail?.source ?? null;
      } catch { return null; }
    };
    (async () => {
      const img = await tryWiki("fr") ?? await tryWiki("en");
      if (!cancelled && img) setUrl(img);
    })();
    return () => { cancelled = true; };
  }, [destination]);
  return url;
}

// ─── Trip Card ────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const start = new Date(dateStr + "T00:00:00");
  return Math.round((start.getTime() - now.getTime()) / 86400000);
}

function TripCard({ trip, index }: { trip: any; index: number }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = useDestinationImage(trip.destination);
  const showImage = imgUrl && !imgError;
  const d = daysUntil(trip.startDate);
  const isActive = d <= 0 && daysUntil(trip.endDate) >= 0;
  const isPast = daysUntil(trip.endDate) < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/voyage/${trip.id}`} className="block">
        <div className="group relative h-52 rounded-2xl overflow-hidden cursor-pointer shadow-md shadow-blue-900/10 hover:shadow-xl hover:shadow-blue-900/15 transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]">
          {showImage ? (
            <img
              src={imgUrl}
              alt={trip.destination}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400 via-blue-500 to-indigo-600" />
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

          {/* Status badge + counters top */}
          <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
            {isActive ? (
              <span className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-500/90 backdrop-blur-md px-2.5 py-1 rounded-full shadow">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                En cours
              </span>
            ) : isPast ? (
              <span className="text-[11px] font-semibold text-white/80 bg-black/30 backdrop-blur-md px-2.5 py-1 rounded-full">Terminé</span>
            ) : (
              <span className="text-[11px] font-semibold text-white/90 bg-black/25 backdrop-blur-md px-2.5 py-1 rounded-full">
                J−{d}
              </span>
            )}
            <div className="flex gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-white/95 bg-black/25 backdrop-blur-md px-2 py-1 rounded-full">
                <Compass className="w-2.5 h-2.5" />{trip.eventCount}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-white/95 bg-black/25 backdrop-blur-md px-2 py-1 rounded-full">
                <Users className="w-2.5 h-2.5" />{trip.memberCount}
              </span>
            </div>
          </div>

          {/* Content bottom */}
          <div className="absolute bottom-0 inset-x-0 p-4">
            <h3 className="text-base font-bold text-white leading-snug mb-1.5">{trip.name}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-white/80 text-xs">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[140px]">{trip.destination}</span>
              </div>
              <div className="flex items-center gap-1 text-white/70 text-[11px] bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full shrink-0">
                <CalendarDays className="w-2.5 h-2.5" />
                {format(new Date(trip.startDate), "dd MMM yy", { locale: fr })}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { userId, username, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  const { data: trips, isLoading, isError } = useGetTrips(
    { userId: userId! },
    { query: { enabled: !!userId } }
  );

  const createTripMutation = useCreateTrip({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTripsQueryKey({ userId: userId! }) });
        setIsCreateModalOpen(false);
      }
    }
  });

  const joinTripMutation = useJoinTrip({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTripsQueryKey({ userId: userId! }) });
        setIsJoinModalOpen(false);
      }
    }
  });

  const handleLogout = () => { logout(); setLocation("/login"); };
  const tripCount = trips?.length ?? 0;
  const initial = (username ?? "?")[0].toUpperCase();

  return (
    <div
      className="min-h-screen pb-28 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)" }}
    >
      {/* Blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-300/15 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-72 h-72 rounded-full bg-sky-200/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/55 backdrop-blur-2xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <img src={logoImg} alt="Ready2Go" className="h-8 w-auto shrink-0" />

          {/* Right: username avatar + logout */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white/60 border border-white/80 rounded-full pl-1 pr-3 py-1">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {initial}
              </div>
              <span className="text-sm font-semibold text-slate-600 hidden xs:block max-w-[90px] truncate">
                {username}
              </span>
            </div>
            <button
              onClick={handleLogout}
              title="Se déconnecter"
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4">
        {/* Welcome */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-7 pb-5"
        >
          <p className="text-sm font-medium text-blue-400 mb-0.5">Bonjour, {username} 👋</p>
          <h1 className="text-2xl font-bold text-slate-700 leading-tight">
            {tripCount === 0
              ? "Votre prochain voyage ?"
              : tripCount === 1
              ? "1 voyage planifié"
              : `${tripCount} voyages planifiés`}
          </h1>
        </motion.div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-24 text-slate-400"
            >
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-blue-400" />
              <p className="text-sm">Chargement de vos aventures…</p>
            </motion.div>
          ) : isError ? (
            <motion.div key="error" className="text-center py-20 text-sm text-red-400">
              Impossible de charger les voyages. Veuillez réessayer.
            </motion.div>
          ) : trips?.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/60 backdrop-blur-xl border border-white/80 rounded-3xl p-10 text-center flex flex-col items-center shadow-lg shadow-blue-900/5"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
                <Plane className="w-8 h-8 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Prêt pour l'aventure ?</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-xs leading-relaxed">
                Créez votre premier voyage ou rejoignez celui de vos proches avec un code d'invitation.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                <Button onClick={() => setIsCreateModalOpen(true)} className="flex-1 gap-2 rounded-xl shadow-sm shadow-blue-500/20">
                  <Plus className="w-4 h-4" />
                  Créer
                </Button>
                <Button onClick={() => setIsJoinModalOpen(true)} variant="outline" className="flex-1 gap-2 rounded-xl">
                  <QrCode className="w-4 h-4" />
                  Rejoindre
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="trips"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid gap-3.5 sm:grid-cols-2"
            >
              {trips?.map((trip, index) => (
                <TripCard key={trip.id} trip={trip} index={index} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* FABs */}
      <div className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 flex flex-col gap-3 z-40">
        {/* Secondary: join */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsJoinModalOpen(true)}
          title="Rejoindre un voyage"
          className="w-12 h-12 bg-white/80 backdrop-blur-md text-slate-600 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/10 hover:shadow-xl border border-white/80 transition-shadow"
        >
          <QrCode className="w-5 h-5" />
        </motion.button>

        {/* Primary: create */}
        <motion.button
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsCreateModalOpen(true)}
          title="Créer un voyage"
          className="w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 transition-shadow"
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      </div>

      {/* Modals */}
      <CreateTripModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={(data) => createTripMutation.mutate({ data: { ...data, creatorId: userId! } })}
        isPending={createTripMutation.isPending}
      />
      <JoinTripModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
        onJoin={(code) => joinTripMutation.mutate({ data: { inviteCode: code, userId: userId! } })}
        isPending={joinTripMutation.isPending}
        error={joinTripMutation.isError ? "Code invalide ou vous êtes déjà membre." : null}
      />
    </div>
  );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function CreateTripModal({ isOpen, onClose, onCreate, isPending }: any) {
  const [formData, setFormData] = useState({ name: "", destination: "", description: "", startDate: "", endDate: "" });
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onCreate(formData); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Voyage">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nom du voyage</Label>
          <Input required placeholder="Roadtrip d'été" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
        </div>
        <div>
          <Label>Destination</Label>
          <Input required placeholder="Barcelone, Espagne" value={formData.destination} onChange={e => setFormData({ ...formData, destination: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Début</Label>
            <Input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
          </div>
          <div>
            <Label>Fin</Label>
            <Input type="date" required value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Description (optionnel)</Label>
          <Input placeholder="Un petit mot sur le voyage…" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
        </div>
        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer le voyage"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function JoinTripModal({ isOpen, onClose, onJoin, isPending, error }: any) {
  const [code, setCode] = useState("");
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onJoin(code.toUpperCase()); };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rejoindre un voyage">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-slate-400">
          Saisissez le code d'invitation à 8 caractères que l'organisateur vous a partagé.
        </p>
        <div>
          <Label>Code d'invitation</Label>
          <Input
            required
            placeholder="ABCD1234"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="uppercase tracking-[0.35em] text-center text-xl font-bold"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="pt-1 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || code.length < 8}>
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Rejoindre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
