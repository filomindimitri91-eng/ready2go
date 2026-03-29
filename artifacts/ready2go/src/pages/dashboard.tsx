import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Users, CalendarDays, MapPin, LogOut, Loader2, Compass, Plane } from "lucide-react";
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

function TripCard({ trip, index }: { trip: any; index: number }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = useDestinationImage(trip.destination);
  const showImage = imgUrl && !imgError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href={`/voyage/${trip.id}`} className="block">
        <div className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-md shadow-blue-900/10 hover:shadow-xl hover:shadow-blue-900/15 transition-all duration-300 hover:-translate-y-0.5">
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
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

          {/* Badges top-right */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            <span className="flex items-center gap-1 text-[11px] font-semibold text-white/95 bg-black/25 backdrop-blur-md px-2 py-1 rounded-full">
              <Compass className="w-2.5 h-2.5" />{trip.eventCount}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-white/95 bg-black/25 backdrop-blur-md px-2 py-1 rounded-full">
              <Users className="w-2.5 h-2.5" />{trip.memberCount}
            </span>
          </div>

          {/* Content bottom */}
          <div className="absolute bottom-0 inset-x-0 p-4">
            <h3 className="text-base font-bold text-white leading-snug mb-1">{trip.name}</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-white/80 text-xs">
                <MapPin className="w-3 h-3" />
                <span>{trip.destination}</span>
              </div>
              <div className="flex items-center gap-1 text-white/70 text-[11px] bg-black/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
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

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const tripCount = trips?.length ?? 0;

  return (
    <div className="min-h-screen pb-28 relative overflow-hidden" style={{background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)"}}>
      {/* Blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-300/15 blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 w-72 h-72 rounded-full bg-sky-200/20 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/55 backdrop-blur-2xl border-b border-white/60">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <img src={logoImg} alt="Ready2Go" className="h-8 w-auto" />
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500 hidden sm:block">
              {username}
            </span>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-white/70 transition-all"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4">
        {/* Welcome banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-7 pb-5"
        >
          <div className="flex items-end justify-between">
            <div>
              <p className="text-sm font-medium text-blue-400 mb-0.5">Bonjour, {username} 👋</p>
              <h1 className="text-2xl font-bold text-slate-700 leading-tight">
                {tripCount === 0 ? "Votre prochain voyage ?" : tripCount === 1 ? "1 voyage en cours" : `${tripCount} voyages`}
              </h1>
            </div>
            <button
              onClick={() => setIsJoinModalOpen(true)}
              className="flex items-center gap-1.5 text-sm font-medium text-blue-500 hover:text-blue-600 bg-white/60 hover:bg-white/80 backdrop-blur-sm px-3.5 py-2 rounded-full border border-white/70 transition-all shadow-sm"
            >
              <Users className="w-3.5 h-3.5" />
              Rejoindre
            </button>
          </div>
        </motion.div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-3 text-blue-400" />
            <p className="text-sm">Chargement de vos aventures…</p>
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-sm text-red-400">
            Une erreur est survenue lors du chargement des voyages.
          </div>
        ) : trips?.length === 0 ? (
          <motion.div
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
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2 rounded-xl shadow-sm shadow-blue-500/20">
              <Plus className="w-4 h-4" />
              Créer un voyage
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-3.5 sm:grid-cols-2">
            {trips?.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} index={index} />
            ))}
          </div>
        )}
      </main>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-5 sm:bottom-8 sm:right-8 w-14 h-14 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 transition-shadow z-40"
      >
        <Plus className="w-6 h-6" />
      </motion.button>

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
