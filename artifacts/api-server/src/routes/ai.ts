import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { speechToText, textToSpeech, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

// POST /api/ai/translate
// Body: { audioBase64: string, mimeType: string, targetLang: string, targetLangName: string, destination: string }
// Returns: { transcription, translation, audioBase64 }
router.post("/ai/translate", async (req, res) => {
  try {
    const { audioBase64, mimeType, targetLang, targetLangName, destination } = req.body as {
      audioBase64: string;
      mimeType: string;
      targetLang: string;
      targetLangName: string;
      destination: string;
    };

    if (!audioBase64) {
      res.status(400).json({ error: "audioBase64 est requis" });
      return;
    }

    const rawBuffer = Buffer.from(audioBase64, "base64");
    const { buffer, format } = await ensureCompatibleFormat(rawBuffer);

    // 1. Transcription (STT)
    const transcription = await speechToText(buffer, format);

    if (!transcription.trim()) {
      res.status(422).json({ error: "Aucune parole détectée dans l'enregistrement." });
      return;
    }

    // 2. Translation via GPT
    const translationRes = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `Tu es un traducteur expert. Traduis le texte de l'utilisateur en ${targetLangName}. Destination du voyage: ${destination || "inconnue"}. Réponds UNIQUEMENT avec la traduction, sans explication ni ponctuation supplémentaire.`,
        },
        { role: "user", content: transcription },
      ],
    });

    const translation = translationRes.choices[0]?.message?.content?.trim() ?? "";

    // 3. TTS — generate audio of the translation
    const ttsBuffer = await textToSpeech(translation, "nova");
    const audioOut = ttsBuffer.toString("base64");

    res.json({ transcription, translation, audioBase64: audioOut });
  } catch (err: any) {
    console.error("[ai/translate]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/chat (streaming SSE)
// Body: { messages: [{role, content}], destination: string, systemPrompt?: string }
router.post("/ai/chat", async (req, res) => {
  try {
    const { messages, destination, systemPrompt } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
      destination: string;
      systemPrompt?: string;
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const system = systemPrompt
      ?? `Tu es un assistant de voyage expert et enthousiaste. Le voyage est à destination de : "${destination}". Tu aides les voyageurs à trouver des idées d'activités, de transport, de logement et de restaurants adaptés à leur destination. Réponds toujours en français, de manière concise et pratique. Utilise des emojis pour rendre tes réponses vivantes.`;

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("[ai/chat]", err);
    res.write(`data: ${JSON.stringify({ error: err?.message ?? "Erreur serveur" })}\n\n`);
    res.end();
  }
});

export default router;
