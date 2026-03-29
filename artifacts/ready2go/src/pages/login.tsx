import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, Plane, Users, CalendarCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCreateUser } from "@workspace/api-client-react";
import { Button, Input, Label } from "@/components/ui-elements";
import logoImg from "@/assets/logo.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const createUserMutation = useCreateUser({
    mutation: {
      onSuccess: (data) => {
        login(data.id, data.username);
        setLocation("/");
      },
      onError: () => {
        setError("Erreur lors de la connexion. Veuillez réessayer.");
      }
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError("Le pseudo est requis.");
      return;
    }
    createUserMutation.mutate({ data: { username: username.trim() } });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4" style={{background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)"}}>
      {/* Soft background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-300/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-sky-200/20 blur-3xl" />
        {/* Subtle travel icons */}
        <svg className="absolute top-10 right-16 opacity-[0.07] w-24 h-24 text-blue-600 rotate-12" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <svg className="absolute bottom-20 left-10 opacity-[0.07] w-16 h-16 text-indigo-500 -rotate-12" fill="none" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24"><path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
        <svg className="absolute top-1/3 left-6 opacity-[0.06] w-10 h-10 text-sky-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[360px]"
      >
        {/* Logo block */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex justify-center mb-5"
          >
            <img src={logoImg} alt="Ready2Go" className="w-44 h-auto drop-shadow-sm" />
          </motion.div>
          <p className="text-[15px] font-medium text-slate-500 tracking-wide">
            Voyagez ensemble, sans prise de tête
          </p>
        </div>

        {/* Form card — glass */}
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/8 border border-white/80 p-7">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Bienvenue</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-sm font-medium text-slate-600">
                Comment on vous appelle ?
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="Ex: VoyageurIntrépide"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                disabled={createUserMutation.isPending}
                autoFocus
                className="mt-1.5 h-12 rounded-xl border-slate-200 bg-white/80 focus:bg-white text-base placeholder:text-slate-300"
              />
              {error && (
                <p className="text-destructive text-sm mt-2">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-sm shadow-blue-500/20 mt-1"
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Connexion...</>
              ) : (
                "C'est parti ! →"
              )}
            </Button>
          </form>
        </div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-3 mt-6 flex-wrap"
        >
          {[
            { icon: Plane, label: "Voyages" },
            { icon: Users, label: "Groupes" },
            { icon: CalendarCheck, label: "Planning" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/60">
              <Icon className="w-3 h-3 text-blue-400" />
              {label}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
}
