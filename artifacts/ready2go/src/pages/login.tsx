import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-background relative overflow-hidden px-4">
      {/* Decorative Background — blue abstract */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 via-indigo-50 to-sky-100" />
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-200/50 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-56 h-56 rounded-full bg-sky-200/40 blur-2xl" />
        <div className="absolute bottom-1/3 left-1/4 w-48 h-48 rounded-full bg-blue-300/20 blur-2xl" />
        {/* Floating map-pin decorations */}
        <svg className="absolute top-8 left-12 opacity-10 text-blue-500 w-12 h-12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
        <svg className="absolute bottom-16 right-16 opacity-10 text-indigo-500 w-16 h-16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/></svg>
        <svg className="absolute top-1/2 left-8 opacity-8 text-sky-400 w-8 h-8" viewBox="0 0 24 24" fill="currentColor"><path d="M21 3L3 10.53v.98l6.84 2.65L12.48 21h.98z"/></svg>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 w-full max-w-sm"
      >
        <div className="text-center mb-10">
          <div className="flex justify-center mb-4">
            <img
              src={logoImg}
              alt="Ready2Go logo"
              className="w-52 h-auto mix-blend-multiply"
            />
          </div>
          <p className="text-base font-semibold text-primary/80 italic tracking-wide">
            Ensemble, on va plus loin
          </p>
        </div>

        <div className="bg-card p-8 rounded-3xl shadow-xl shadow-primary/5 border border-border/50 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <Label htmlFor="username">Comment on vous appelle ?</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ex: VoyageurInterGalactique"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                disabled={createUserMutation.isPending}
                autoFocus
                className="text-lg py-6"
              />
              {error && (
                <p className="text-destructive text-sm mt-2 font-medium">{error}</p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full text-lg py-4 rounded-xl"
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Connexion...
                </>
              ) : (
                "C'est parti !"
              )}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
