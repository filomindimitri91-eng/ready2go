import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import logoImg from "@/assets/logo.png";
import { MapPinOff } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-6 text-center"
      style={{ background: "linear-gradient(135deg, #e0f2fe 0%, #ede9fe 50%, #dbeafe 100%)" }}
    >
      <img src={logoImg} alt="Ready2Go" className="h-10 w-auto mb-8 opacity-80" />
      <div className="bg-white/65 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm px-8 py-8 max-w-sm w-full">
        <MapPinOff className="w-10 h-10 text-primary/50 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Page introuvable</h1>
        <p className="text-slate-500 text-sm mb-6">
          Cette page n'existe pas ou a été déplacée.
        </p>
        <Link href="/">
          <Button className="w-full">Retour à l'accueil</Button>
        </Link>
      </div>
    </div>
  );
}
