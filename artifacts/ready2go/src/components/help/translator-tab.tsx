import { useState, useRef } from "react";
import { Mic, MicOff, Volume2, Loader2, RefreshCw, ChevronDown } from "lucide-react";
import { useVoiceRecorder } from "@workspace/integrations-openai-ai-react";
import { detectLanguage } from "@/lib/emergency-numbers";

interface Props {
  destination: string;
  apiBase: string;
}

type State = "idle" | "recording" | "processing" | "done" | "error";

const LANGUAGES = [
  { lang: "ar", name: "Arabe", flag: "🇸🇦" },
  { lang: "zh", name: "Chinois", flag: "🇨🇳" },
  { lang: "ko", name: "Coréen", flag: "🇰🇷" },
  { lang: "da", name: "Danois", flag: "🇩🇰" },
  { lang: "es", name: "Espagnol", flag: "🇪🇸" },
  { lang: "fi", name: "Finnois", flag: "🇫🇮" },
  { lang: "el", name: "Grec", flag: "🇬🇷" },
  { lang: "hi", name: "Hindi", flag: "🇮🇳" },
  { lang: "id", name: "Indonésien", flag: "🇮🇩" },
  { lang: "en", name: "Anglais", flag: "🇬🇧" },
  { lang: "it", name: "Italien", flag: "🇮🇹" },
  { lang: "ja", name: "Japonais", flag: "🇯🇵" },
  { lang: "nl", name: "Néerlandais", flag: "🇳🇱" },
  { lang: "nb", name: "Norvégien", flag: "🇳🇴" },
  { lang: "fa", name: "Persan", flag: "🇮🇷" },
  { lang: "pl", name: "Polonais", flag: "🇵🇱" },
  { lang: "pt", name: "Portugais", flag: "🇵🇹" },
  { lang: "ro", name: "Roumain", flag: "🇷🇴" },
  { lang: "ru", name: "Russe", flag: "🇷🇺" },
  { lang: "sv", name: "Suédois", flag: "🇸🇪" },
  { lang: "th", name: "Thaï", flag: "🇹🇭" },
  { lang: "cs", name: "Tchèque", flag: "🇨🇿" },
  { lang: "tr", name: "Turc", flag: "🇹🇷" },
  { lang: "uk", name: "Ukrainien", flag: "🇺🇦" },
  { lang: "vi", name: "Vietnamien", flag: "🇻🇳" },
].sort((a, b) => a.name.localeCompare(b.name, "fr"));

export function TranslatorTab({ destination, apiBase }: Props) {
  const [uiState, setUiState] = useState<State>("idle");
  const [transcription, setTranscription] = useState("");
  const [translation, setTranslation] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const autoDetected = detectLanguage(destination);
  const [selectedLang, setSelectedLang] = useState<{ lang: string; name: string; flag: string }>(autoDetected);

  const recorder = useVoiceRecorder({
    onStop: async (blob) => {
      setUiState("processing");
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(arrayBuffer).reduce((acc, byte) => acc + String.fromCharCode(byte), "")
        );

        const res = await fetch(`${apiBase}/api/ai/translate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audioBase64: base64,
            mimeType: blob.type,
            targetLang: selectedLang.lang,
            targetLangName: selectedLang.name,
            destination,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Erreur serveur");
        }

        const data = await res.json();
        setTranscription(data.transcription);
        setTranslation(data.translation);

        if (data.audioBase64) {
          const audioBlob = new Blob(
            [Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0))],
            { type: "audio/mpeg" }
          );
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => setIsPlaying(false);
          audio.play();
          setIsPlaying(true);
        }

        setUiState("done");
      } catch (err: any) {
        setErrorMsg(err?.message ?? "Erreur inattendue");
        setUiState("error");
      }
    },
  });

  const toggleRecording = () => {
    if (recorder.state === "recording") {
      recorder.stop();
    } else {
      setUiState("recording");
      setTranscription("");
      setTranslation("");
      setErrorMsg("");
      recorder.start();
    }
  };

  const playTranslation = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const reset = () => {
    setUiState("idle");
    setTranscription("");
    setTranslation("");
    setErrorMsg("");
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  };

  const isRecording = recorder.state === "recording";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-2xl p-4">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎙️</span>
          <div>
            <p className="font-bold text-violet-800">Traducteur vocal</p>
            <p className="text-xs text-violet-600">
              Parlez en français, obtenez la traduction instantanée
            </p>
          </div>
        </div>

        {/* Language selector */}
        <div className="mt-3">
          <p className="text-[11px] font-semibold text-violet-700 mb-1.5 uppercase tracking-wide">
            Traduire vers :
          </p>
          <div className="relative">
            <button
              onClick={() => setShowLangPicker(v => !v)}
              className="w-full flex items-center justify-between gap-2 bg-white border border-violet-200 rounded-xl px-3 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg leading-none">{selectedLang.flag}</span>
                <span>{selectedLang.name}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-violet-400 transition-transform ${showLangPicker ? "rotate-180" : ""}`} />
            </button>

            {showLangPicker && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-violet-100 rounded-xl shadow-xl overflow-hidden">
                <div className="max-h-52 overflow-y-auto">
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.lang}
                      onClick={() => {
                        setSelectedLang(l);
                        setShowLangPicker(false);
                        reset();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-violet-50 transition-colors text-left ${
                        selectedLang.lang === l.lang ? "bg-violet-50 font-semibold text-violet-700" : "text-foreground"
                      }`}
                    >
                      <span className="text-base leading-none">{l.flag}</span>
                      <span>{l.name}</span>
                      {selectedLang.lang === l.lang && (
                        <span className="ml-auto text-violet-500 text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {autoDetected.lang !== selectedLang.lang && (
            <button
              onClick={() => { setSelectedLang(autoDetected); reset(); }}
              className="mt-1.5 text-[11px] text-violet-500 hover:text-violet-700 underline"
            >
              Revenir à la langue détectée ({autoDetected.flag} {autoDetected.name})
            </button>
          )}
        </div>
      </div>

      {/* Mic button */}
      <div className="flex flex-col items-center gap-4 py-4">
        <button
          onClick={toggleRecording}
          disabled={uiState === "processing"}
          className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all active:scale-95 ${
            isRecording
              ? "bg-red-500 hover:bg-red-600 animate-pulse"
              : uiState === "processing"
              ? "bg-muted cursor-not-allowed"
              : "bg-primary hover:bg-primary/90"
          }`}
        >
          {uiState === "processing" ? (
            <Loader2 className="w-10 h-10 text-white animate-spin" />
          ) : isRecording ? (
            <MicOff className="w-10 h-10 text-white" />
          ) : (
            <Mic className="w-10 h-10 text-white" />
          )}
        </button>

        <p className="text-sm font-medium text-muted-foreground text-center">
          {isRecording
            ? "Enregistrement… Appuyez pour arrêter"
            : uiState === "processing"
            ? "Traduction en cours…"
            : uiState === "done"
            ? "Traduction terminée ✓"
            : "Appuyez pour parler"}
        </p>
      </div>

      {/* Results */}
      {uiState === "done" && transcription && (
        <div className="space-y-3">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              🇫🇷 Vous avez dit
            </p>
            <p className="text-sm text-foreground italic">"{transcription}"</p>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                {selectedLang.flag} Traduction — {selectedLang.name}
              </p>
              {audioRef.current && (
                <button
                  onClick={playTranslation}
                  className="flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg px-2.5 py-1 transition-colors"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  {isPlaying ? "Pause" : "Écouter"}
                </button>
              )}
            </div>
            <p className="text-base font-bold text-foreground">"{translation}"</p>
          </div>

          <button
            onClick={reset}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground mx-auto transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Nouvelle traduction
          </button>
        </div>
      )}

      {/* Error */}
      {uiState === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center space-y-3">
          <p className="text-sm text-red-700 font-medium">❌ {errorMsg}</p>
          <button onClick={reset} className="text-xs text-red-500 hover:text-red-700 underline">
            Réessayer
          </button>
        </div>
      )}

      {/* Tip */}
      {uiState === "idle" && (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
          <p className="text-xs text-amber-700">
            💡 <b>Exemples :</b> "Où est la gare ?", "Je suis allergique aux noix", "Appelez une ambulance s'il vous plaît", "Combien ça coûte ?"
          </p>
        </div>
      )}
    </div>
  );
}
