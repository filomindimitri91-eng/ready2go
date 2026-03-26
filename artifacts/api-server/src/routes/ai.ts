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

// POST /api/ai/generate-program
// Body: { destination, startDate, endDate, existingEvents, creatorId }
// Returns: { events: [{type, title, date, startTime, endTime, location, notes}] }
router.post("/ai/generate-program", async (req, res) => {
  try {
    const { destination, startDate, endDate, existingEvents, creatorId } = req.body as {
      destination: string;
      startDate: string;
      endDate: string;
      existingEvents: { type: string; title: string; date: string; startTime?: string; endTime?: string; location?: string }[];
      creatorId: number;
    };

    const isEmpty = existingEvents.length === 0;
    const existingSummary = isEmpty
      ? "AUCUN ÉVÉNEMENT — le programme est entièrement vide, tu dois remplir TOUTES les journées de A à Z."
      : existingEvents.map(e => `- ${e.date} ${e.startTime ?? "?"}: [${e.type}] ${e.title}${e.location ? ` @ ${e.location}` : ""}`).join("\n");

    const prompt = `Tu es un expert en planification de voyages qui s'appuie sur les meilleurs blogs voyage (Lonely Planet, Routard, Condé Nast Traveler, Atlas Obscura, Time Out, culture trip, etc.) et les avis TripAdvisor / Google Maps. Génère un programme de voyage COMPLET pour "${destination}" du ${startDate} au ${endDate}.

ÉTAT ACTUEL DU PROGRAMME :
${existingSummary}

MISSION ABSOLUE :
${isEmpty
  ? `Le programme est VIDE. Tu DOIS générer un programme complet pour CHAQUE jour du voyage, du matin au soir. Il est INTERDIT de retourner un tableau vide. Chaque journée doit être intégralement remplie.`
  : `Complète UNIQUEMENT les créneaux libres entre les événements existants. Ne touche pas aux événements déjà planifiés.`}

RÈGLES :
1. Utilise UNIQUEMENT des noms RÉELS d'établissements : restaurants reconnus, musées, monuments, bars, marchés locaux — jamais de noms inventés
2. Respecte les distances : deux lieux consécutifs doivent être accessibles en max 30 min, ajoute un transport si nécessaire
3. Structure journalière : petit-déjeuner optionnel (~9h), activité matin, déjeuner (~12h-14h), activité après-midi, dîner (~19h-21h) — pas d'événement après 23h
4. Varie les types : restaurants locaux typiques, musées, balades, shopping, bars, expériences culturelles
5. Chaque lieu doit avoir une adresse précise
6. Inclus une note et source pour chaque lieu (TripAdvisor, Google, Lonely Planet, Le Routard, Time Out…)
7. JAMAIS de tableau vide — s'il n'y a pas de créneau libre, génère au moins une suggestion bonus
8. Réponds UNIQUEMENT en JSON valide, sans markdown

FORMAT JSON :
[
  {
    "type": "activite" | "transport" | "restauration" | "autre",
    "title": "Nom réel du lieu",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "Adresse complète précise",
    "rating": "4.5/5",
    "reviewSource": "TripAdvisor" | "Google Maps" | "Lonely Planet" | "Le Routard" | "Time Out" | "Michelin",
    "notes": "Description : spécialités, ambiance, conseil de réservation, why go"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: "Tu es un assistant de planification de voyages expert. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let events: any[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      events = JSON.parse(cleaned);
    } catch {
      events = [];
    }

    res.json({ events });
  } catch (err: any) {
    console.error("[ai/generate-program]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/budget
// Body: { destination, startDate, endDate, nbPeople, events }
// Returns: { categories: [{label, amount, emoji}], total, currency, notes }
router.post("/ai/budget", async (req, res) => {
  try {
    const { destination, startDate, endDate, nbPeople, events } = req.body as {
      destination: string;
      startDate: string;
      endDate: string;
      nbPeople: number;
      events: { type: string; title: string }[];
    };

    const dayCount = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
    const eventSummary = events.map(e => `[${e.type}] ${e.title}`).join(", ") || "Aucun événement planifié";

    const prompt = `Tu es un expert en budget voyage. Estime le budget TOTAL pour un voyage à "${destination}" du ${startDate} au ${endDate} (${dayCount} jours) pour ${nbPeople} personne(s).

Événements planifiés : ${eventSummary}

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "currency": "EUR",
  "total": 1500,
  "notes": "Estimation basée sur... (1-2 phrases)",
  "categories": [
    { "key": "logement", "label": "Logement", "emoji": "🏨", "amount": 600 },
    { "key": "transport", "label": "Transport", "emoji": "✈️", "amount": 400 },
    { "key": "restauration", "label": "Restauration", "emoji": "🍽️", "amount": 300 },
    { "key": "activite", "label": "Activités", "emoji": "🎭", "amount": 150 },
    { "key": "divers", "label": "Divers", "emoji": "🛍️", "amount": 50 }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 800,
      messages: [
        { role: "system", content: "Tu es un assistant de budget voyage. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let budget: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      budget = JSON.parse(cleaned);
    } catch {
      budget = { currency: "EUR", total: 0, categories: [], notes: "Estimation indisponible" };
    }

    res.json(budget);
  } catch (err: any) {
    console.error("[ai/budget]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/transit
// Body: { from, to, city, date? }
// Returns: { itinerary: string, steps: [{mode, line, from, to, duration, instruction}], mapsUrl }
router.post("/ai/transit", async (req, res) => {
  try {
    const { from, to, city } = req.body as { from: string; to: string; city: string };

    const prompt = `Tu es un expert en transports en commun. Donne l'itinéraire en transports en commun pour aller de "${from}" à "${to}" dans la ville / région de "${city}".

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "summary": "Résumé en 1 phrase (ex: Bus 42 → Métro ligne 3, ~25 min)",
  "totalDuration": "25 min",
  "steps": [
    {
      "mode": "bus" | "metro" | "tram" | "rer" | "train" | "marche" | "autre",
      "emoji": "🚌",
      "line": "42",
      "from": "Arrêt de départ",
      "to": "Arrêt d'arrivée",
      "duration": "8 min",
      "instruction": "Prendre le bus 42 direction Centre-Ville"
    }
  ],
  "tips": "Conseil utile (ex: ticket valable 1h30, zone 1-2...)",
  "mapsUrl": "https://www.google.com/maps/dir/?api=1&origin=FROM&destination=TO&travelmode=transit"
}

Pour mapsUrl, remplace FROM par "${encodeURIComponent(from + ", " + city)}" et TO par "${encodeURIComponent(to + ", " + city)}".`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1200,
      messages: [
        { role: "system", content: "Tu es un expert en transports en commun urbains. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { summary: "Itinéraire indisponible", steps: [], tips: "", mapsUrl: "" };
    }

    res.json(result);
  } catch (err: any) {
    console.error("[ai/transit]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/events-nearby
// Body: { destination, startDate, endDate }
// Returns: { events: [{type, title, date, startTime, endTime, location, venue, distance, rating, reviewSource, notes, category}] }
router.post("/ai/events-nearby", async (req, res) => {
  try {
    const { destination, startDate, endDate } = req.body as {
      destination: string;
      startDate: string;
      endDate: string;
    };

    const prompt = `Tu es un expert en événements culturels, sportifs et de divertissement. Tu connais parfaitement Ticketmaster, Songkick, Bandsintown, les comptes officiels Instagram/Facebook/TikTok des artistes et des salles, les sites des clubs sportifs, les offices du tourisme, et les agendas culturels locaux. Liste les événements notables dans un rayon de 100 km autour de "${destination}" entre le ${startDate} et le ${endDate}.

TYPES D'ÉVÉNEMENTS À INCLURE (tout type confondu) :
- Concerts : artistes connus ou locaux, festivals de musique (rock, électro, classique, jazz…)
- Sport : matchs de football/rugby/basket/tennis, compétitions, Grands Prix, marathons
- Festivals culturels, gastronomiques, cinéma, arts de rue
- Carnavals, fêtes traditionnelles, foires, braderies
- Marchés thématiques (Noël, antiquités, producteurs locaux)
- Expositions temporaires majeures dans les musées
- Spectacles de rue, sons et lumières, feux d'artifice
- Fêtes nationales ou régionales

RÈGLES ABSOLUES :
1. TOUJOURS retourner au moins 8 événements — c'est INTERDIT de retourner moins de 8 résultats
2. Si aucun événement certain n'est connu pour cette date exacte, cherche les événements RÉCURRENTS et ANNUELS de la région à cette période (fêtes nationales, festivals qui ont lieu chaque année, matchs de championnat réguliers selon la saison sportive, marchés hebdomadaires, etc.)
3. Si la période est creuse en événements confirmés, propose les événements permanents ou semi-permanents : expositions longue durée, spectacles hebdomadaires, animations régulières
4. S'inspirer de ce que l'on trouverait sur : Ticketmaster, Eventbrite, Songkick, le compte Instagram officiel de la ville, l'office du tourisme, les clubs sportifs locaux, Facebook Events, les comptes TikTok d'influenceurs locaux
5. Indiquer le lieu PRÉCIS avec son adresse complète
6. Estimer la distance réelle depuis ${destination}
7. Répondre UNIQUEMENT en JSON valide, sans markdown

FORMAT JSON ATTENDU :
[
  {
    "category": "concert" | "sport" | "festival" | "carnaval" | "marché" | "exposition" | "spectacle" | "fête",
    "title": "Nom précis de l'événement ou du lieu",
    "venue": "Nom de la salle, stade, place ou parc",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "Adresse complète",
    "distance": "XX km de ${destination}",
    "rating": "4.X/5",
    "reviewSource": "Ticketmaster" | "TripAdvisor" | "Google" | "Eventbrite" | "Office du tourisme" | "Instagram" | "Notoriété locale",
    "notes": "Description : artiste/équipe/thème, ambiance, billetterie, pourquoi y aller",
    "type": "activite"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: "Tu es un expert en événements culturels et touristiques. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "[]";
    let events: any[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      events = JSON.parse(cleaned);
    } catch {
      events = [];
    }

    res.json({ events });
  } catch (err: any) {
    console.error("[ai/events-nearby]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

export default router;
