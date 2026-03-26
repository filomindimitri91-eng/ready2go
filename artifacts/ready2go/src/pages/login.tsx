import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useCreateUser } from "@workspace/api-client-react";
import { Button, Input, Label } from "@/components/ui-elements";
import logoImg from "@assets/1774511272544_1774511318297.png";

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
      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-multiply pointer-events-none">
        <img 
          src={`${import.meta.env.BASE_URL}images/onboarding-bg.png`}
          alt="Travel background"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
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
