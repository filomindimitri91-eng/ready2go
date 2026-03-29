import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Plane, Users, CalendarCheck, Eye, EyeOff, CheckCircle2, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Label } from "@/components/ui-elements";
import logoImg from "@/assets/logo.png";

type Mode = "login" | "register" | "success";

async function callAuth(path: string, body: Record<string, string>) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur serveur");
  return data as { token: string; userId: number; username: string };
}

export default function Login() {
  const { login } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ username: string; password: string; token: string; userId: number } | null>(null);
  const [copied, setCopied] = useState<"user" | "pass" | null>(null);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    if (next === "register") { setPassword(""); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username.trim()) { setError("Le pseudo est requis."); return; }
    if (!password) { setError("Le mot de passe est requis."); return; }
    if (mode === "register" && password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères."); return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const data = await callAuth(endpoint, { username: username.trim(), password });
      if (mode === "register") {
        setSuccessData({ username: username.trim(), password, token: data.token, userId: data.userId });
        setMode("success");
      } else {
        login(data.userId, data.username, data.token);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la connexion.");
    } finally {
      setLoading(false);
    }
  };

  const handleConnectAfterRegister = () => {
    if (!successData) return;
    login(successData.userId, successData.username, successData.token);
  };

  const copyToClipboard = async (text: string, field: "user" | "pass") => {
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden px-4"
      style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)" }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-blue-300/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-violet-300/15 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] rounded-full bg-sky-200/20 blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[360px]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <img src={logoImg} alt="Ready2Go" className="w-44 h-auto drop-shadow-sm" />
          </div>
          <p className="text-[15px] font-medium text-slate-500 tracking-wide">
            Voyagez ensemble, sans prise de tête
          </p>
        </div>

        <AnimatePresence mode="wait">
          {mode === "success" && successData ? (
            /* ── Success screen ────────────────────────────────────────── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -16 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/8 border border-white/80 p-7"
            >
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-700 mb-1">Compte créé !</h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Notez vos identifiants pour vous connecter la prochaine fois.
                </p>
              </div>

              <div className="space-y-3 mb-6">
                {/* Username row */}
                <div className="bg-slate-50/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3 border border-slate-100">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Pseudo</p>
                    <p className="text-sm font-bold text-slate-700 truncate">{successData.username}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(successData.username, "user")}
                    className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                  >
                    {copied === "user" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password row */}
                <div className="bg-slate-50/80 rounded-xl px-4 py-3 flex items-center justify-between gap-3 border border-slate-100">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Mot de passe</p>
                    <p className="text-sm font-bold text-slate-700 font-mono tracking-wider truncate">
                      {showPassword ? successData.password : "•".repeat(Math.min(successData.password.length, 12))}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(successData.password, "pass")}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-all"
                    >
                      {copied === "pass" ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-sm shadow-blue-500/20"
                onClick={handleConnectAfterRegister}
              >
                Accéder à mon compte →
              </Button>
            </motion.div>
          ) : (
            /* ── Login / Register form ─────────────────────────────────── */
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Mode toggle */}
              <div className="flex bg-white/50 backdrop-blur-sm rounded-2xl p-1 mb-4 border border-white/60">
                {(["login", "register"] as ("login" | "register")[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ${
                      mode === m
                        ? "bg-white shadow-sm text-slate-700"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {m === "login" ? "Connexion" : "Créer un compte"}
                  </button>
                ))}
              </div>

              {/* Form card */}
              <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-xl shadow-blue-900/8 border border-white/80 p-7">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={mode}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4"
                  >
                    {mode === "login" ? "Bienvenue !" : "Nouveau voyageur"}
                  </motion.p>
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="username" className="text-sm font-medium text-slate-600">
                      {mode === "login" ? "Pseudo" : "Choisissez un pseudo"}
                    </Label>
                    <Input
                      id="username"
                      name="username"
                      type="text"
                      placeholder="Ex: VoyageurIntrépide"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value); setError(""); }}
                      disabled={loading}
                      autoFocus
                      autoComplete="username"
                      className="mt-1.5 h-12 rounded-xl border-slate-200 bg-white/80 focus:bg-white text-base placeholder:text-slate-300"
                    />
                  </div>

                  <div>
                    <Label htmlFor="password" className="text-sm font-medium text-slate-600">
                      Mot de passe
                      {mode === "register" && (
                        <span className="ml-1.5 text-[11px] font-normal text-slate-400">(6 caractères min.)</span>
                      )}
                    </Label>
                    <div className="relative mt-1.5">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={mode === "register" ? "Choisissez un mot de passe" : "Votre mot de passe"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(""); }}
                        disabled={loading}
                        autoComplete={mode === "register" ? "new-password" : "current-password"}
                        className="h-12 rounded-xl border-slate-200 bg-white/80 focus:bg-white text-base placeholder:text-slate-300 pr-11"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-red-500 text-sm"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <Button
                    type="submit"
                    className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-sm shadow-blue-500/20 mt-1"
                    disabled={loading}
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {mode === "login" ? "Connexion..." : "Création..."}
                      </>
                    ) : mode === "login" ? (
                      "Se connecter →"
                    ) : (
                      "Créer mon compte →"
                    )}
                  </Button>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature pills */}
        {mode !== "success" && (
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
              <span
                key={label}
                className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/60"
              >
                <Icon className="w-3 h-3 text-blue-400" />
                {label}
              </span>
            ))}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
