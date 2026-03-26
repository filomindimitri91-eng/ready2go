import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Users, CalendarDays, MapPin, LogOut, Loader2, Compass } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/lib/auth-context";
import { 
  useGetTrips, 
  useCreateTrip, 
  useJoinTrip,
  getGetTripsQueryKey
} from "@workspace/api-client-react";
import { Button, Card, Input, Label, Modal } from "@/components/ui-elements";

import logoImg from "@/assets/logo.png";

// ─── Destination image hook ───────────────────────────────────────────────────
// Fetches a representative photo from Wikipedia for the given destination.
// Falls back to English Wikipedia if the French article has no image.

function useDestinationImage(destination: string): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!destination) return;
    let cancelled = false;
    const city = destination.split(",")[0].trim();
    const encoded = encodeURIComponent(city);

    const tryWiki = async (lang: string): Promise<string | null> => {
      try {
        const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encoded}`, {
          headers: { "Accept": "application/json" }
        });
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

// ─── Trip card with destination background ────────────────────────────────────

function TripCard({ trip, index }: { trip: any; index: number }) {
  const [imgError, setImgError] = useState(false);
  const imgUrl = useDestinationImage(trip.destination);
  const showImage = imgUrl && !imgError;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="h-full"
    >
      <Link href={`/voyage/${trip.id}`} className="block h-full">
        <div className="group relative h-52 rounded-2xl overflow-hidden border border-border cursor-pointer shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5">
          {/* Background image */}
          {showImage ? (
            <img
              src={imgUrl}
              alt={trip.destination}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-primary/20 to-blue-500/20" />
          )}

          {/* Gradient overlay for readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />

          {/* Content */}
          <div className="absolute inset-0 flex flex-col justify-between p-4">
            {/* Top: member & event badges */}
            <div className="flex justify-end gap-2">
              <span className="flex items-center gap-1 text-xs font-semibold text-white/90 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                <Compass className="w-3 h-3" />
                {trip.eventCount}
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-white/90 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                <Users className="w-3 h-3" />
                {trip.memberCount}
              </span>
            </div>

            {/* Bottom: trip info */}
            <div>
              <h3 className="text-lg font-bold text-white leading-tight mb-1 drop-shadow">
                {trip.name}
              </h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 text-white/80 text-sm">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="font-medium">{trip.destination}</span>
                </div>
                <div className="flex items-center gap-1 text-white/80 text-xs bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                  <CalendarDays className="w-3 h-3" />
                  {format(new Date(trip.startDate), "dd MMM yy", { locale: fr })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

export default function Dashboard() {
  const { userId, username, logout } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  // Queries
  const { data: trips, isLoading, isError } = useGetTrips(
    { userId: userId! },
    { query: { enabled: !!userId } }
  );

  // Mutations
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

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Ready2Go" className="h-9 w-auto" />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground hidden sm:inline-block">
              Salut, {username}
            </span>
            <Button variant="ghost" className="p-2 h-auto" onClick={handleLogout}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-3xl font-extrabold text-foreground">Mes Voyages</h2>
          <Button variant="outline" onClick={() => setIsJoinModalOpen(true)} className="gap-2">
            <Users className="w-4 h-4" />
            Rejoindre
          </Button>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-primary" />
            <p>Chargement de vos aventures...</p>
          </div>
        ) : isError ? (
          <div className="text-center py-20 text-destructive">
            Une erreur est survenue lors du chargement des voyages.
          </div>
        ) : trips?.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-dashed border-border rounded-3xl p-10 text-center flex flex-col items-center"
          >
            <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
              <MapPin className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">Aucun voyage prévu</h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              C'est le moment idéal pour planifier votre prochaine escapade ou rejoindre celle de vos amis !
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
              <Plus className="w-5 h-5" />
              Créer mon premier voyage
            </Button>
          </motion.div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {trips?.map((trip, index) => (
              <TripCard key={trip.id} trip={trip} index={index} />
            ))}
          </div>
        )}
      </main>

      {/* Floating Action Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center shadow-lg shadow-primary/40 hover:shadow-xl transition-shadow z-40"
      >
        <Plus className="w-8 h-8" />
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

// Sub-components for Modals

function CreateTripModal({ isOpen, onClose, onCreate, isPending }: any) {
  const [formData, setFormData] = useState({
    name: "",
    destination: "",
    description: "",
    startDate: "",
    endDate: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate(formData);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Nouveau Voyage">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label>Nom du voyage</Label>
          <Input 
            required 
            placeholder="Roadtrip d'été" 
            value={formData.name}
            onChange={e => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <Label>Destination</Label>
          <Input 
            required 
            placeholder="Barcelone, Espagne" 
            value={formData.destination}
            onChange={e => setFormData({...formData, destination: e.target.value})}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Début</Label>
            <Input 
              type="date" 
              required 
              value={formData.startDate}
              onChange={e => setFormData({...formData, startDate: e.target.value})}
            />
          </div>
          <div>
            <Label>Fin</Label>
            <Input 
              type="date" 
              required 
              value={formData.endDate}
              onChange={e => setFormData({...formData, endDate: e.target.value})}
            />
          </div>
        </div>
        <div>
          <Label>Description (optionnel)</Label>
          <Input 
            placeholder="Un petit mot sur le voyage..." 
            value={formData.description}
            onChange={e => setFormData({...formData, description: e.target.value})}
          />
        </div>
        <div className="pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Créer le voyage"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function JoinTripModal({ isOpen, onClose, onJoin, isPending, error }: any) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onJoin(code.toUpperCase());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Rejoindre un voyage">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Saisissez le code d'invitation à 8 caractères que l'organisateur vous a partagé.
        </p>
        <div>
          <Label>Code d'invitation</Label>
          <Input 
            required 
            placeholder="EX: ABCD1234" 
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={8}
            className="uppercase tracking-widest text-center text-xl font-bold"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="pt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || code.length < 8}>
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Rejoindre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
