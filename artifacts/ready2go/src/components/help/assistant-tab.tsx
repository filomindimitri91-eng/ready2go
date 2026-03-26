import { useState, useRef, useEffect } from "react";
import { Send, Bot, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_QUESTIONS = [
  "Quelles activités incontournables me recommandes-tu ?",
  "Quel est le meilleur moyen de transport sur place ?",
  "Où dormir pour un bon rapport qualité/prix ?",
  "Quels restaurants locaux authentiques visiter ?",
  "Quels sont les plats typiques à goûter absolument ?",
  "Quels quartiers ou zones recommandes-tu ?",
];

interface Props {
  destination: string;
  apiBase: string;
}

export function AssistantTab({ destination, apiBase }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setStreaming(true);

    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const response = await fetch(`${apiBase}/api/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages, destination }),
      });

      if (!response.body) throw new Error("No stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  ...updated[updated.length - 1],
                  content: updated[updated.length - 1].content + data.content,
                };
                return updated;
              });
            }
            if (data.done) break;
          } catch {}
        }
      }
    } catch (err) {
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "❌ Erreur de connexion. Veuillez réessayer." };
        return updated;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Intro (when no messages) */}
      {messages.length === 0 && (
        <div className="flex-1 space-y-4">
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-bold text-foreground text-base">Assistant voyage IA</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Spécialisé pour {destination}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
              Questions rapides
            </p>
            <div className="grid grid-cols-1 gap-2">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm bg-card hover:bg-primary/5 border border-border hover:border-primary/30 rounded-xl px-3 py-2.5 transition-all text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      {messages.length > 0 && (
        <div className="flex-1 space-y-3 overflow-y-auto pb-2 min-h-0 max-h-[55vh]">
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center shrink-0 mr-2 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-card border border-border text-foreground rounded-bl-sm"
                )}
              >
                {msg.content}
                {msg.role === "assistant" && msg.content === "" && streaming && (
                  <span className="inline-block w-2 h-4 bg-primary/50 animate-pulse rounded-sm ml-0.5" />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Reset */}
      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground self-center mb-2 mt-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" /> Nouvelle conversation
        </button>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mt-2 items-end">
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={`Pose une question sur ${destination}…`}
          rows={2}
          className="flex-1 resize-none text-sm border border-border rounded-xl px-3 py-2.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          disabled={streaming}
        />
        <button
          type="submit"
          disabled={!input.trim() || streaming}
          className="w-10 h-10 bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground rounded-xl flex items-center justify-center transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
