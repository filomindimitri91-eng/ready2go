import { useState } from "react";
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
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Ready2Go</h1>
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
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/voyage/${trip.id}`} className="block h-full">
                  <Card className="h-full flex flex-col cursor-pointer group hover:border-primary/30">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold mb-1 group-hover:text-primary transition-colors">
                        {trip.name}
                      </h3>
                      <div className="flex items-center text-muted-foreground text-sm mb-4">
                        <MapPin className="w-4 h-4 mr-1" />
                        {trip.destination}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-border/50 flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center bg-secondary/50 px-2 py-1 rounded-md text-secondary-foreground">
                        <CalendarDays className="w-4 h-4 mr-1.5" />
                        {format(new Date(trip.startDate), "dd MMM", { locale: fr })}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center" title="Événements">
                          <Compass className="w-4 h-4 mr-1 text-primary/70" />
                          {trip.eventCount}
                        </span>
                        <span className="flex items-center" title="Membres">
                          <Users className="w-4 h-4 mr-1 text-primary/70" />
                          {trip.memberCount}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
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
          Saisissez le code d'invitation à 6 caractères que l'organisateur vous a partagé.
        </p>
        <div>
          <Label>Code d'invitation</Label>
          <Input 
            required 
            placeholder="EX: ABCDEF" 
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="uppercase tracking-widest text-center text-xl font-bold"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="pt-2 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Annuler</Button>
          <Button type="submit" disabled={isPending || code.length < 3}>
            {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Rejoindre"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
