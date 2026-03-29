import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { speechToText, textToSpeech, ensureCompatibleFormat } from "@workspace/integrations-openai-ai-server/audio";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

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
      ? "AUCUN ÉVÉNEMENT — programme entièrement vide."
      : existingEvents.map(e => `- ${e.date} ${e.startTime ?? "?"}: [${e.type}] ${e.title}${e.location ? ` @ ${e.location}` : ""}`).join("\n");

    const prompt = `Tu es l'assistant de voyage Ready2Go, un guide expert incarné par la Boussole. Tu t'appuies sur Lonely Planet, Le Routard, Condé Nast Traveler, Atlas Obscura, Time Out, TripAdvisor, Google Maps et les meilleurs blogs voyage pour créer des itinéraires mémorables.

DESTINATION : ${destination}
PÉRIODE : du ${startDate} au ${endDate}
PROGRAMME EXISTANT :
${existingSummary}

MISSION :
${isEmpty
  ? "Le programme est VIDE. Tu DOIS générer un itinéraire COMPLET pour CHAQUE journée, du matin au soir. INTERDIT de retourner un tableau vide ou incomplet."
  : "Complète UNIQUEMENT les créneaux libres. Ne touche pas aux événements existants."}

STRUCTURE DE CHAQUE JOURNÉE (obligatoire) :
- MATIN (~09h00–12h30) : 1 activité ou visite de site
- DÉJEUNER (~12h30–14h00) : 1 restaurant local reconnu
- APRÈS-MIDI (~14h00–18h30) : 1 à 2 activités / balades / shopping
- SOIR (~19h00–21h30) : 1 dîner dans un établissement réputé
- Ajoute un transport entre deux lieux distants de plus de 20 min

RÈGLES IMPÉRATIVES :
1. Noms RÉELS uniquement — restaurants réputés, musées officiels, monuments reconnus, aucun nom inventé
2. Adresse précise pour chaque lieu
3. Note (ex: "4.6/5") et source (TripAdvisor, Google, Lonely Planet, Le Routard, Time Out, Michelin…)
4. Distances logiques : pas de croisements inutiles de la ville
5. JAMAIS de tableau vide — minimum 3 événements par jour
6. Réponds UNIQUEMENT en JSON valide, sans markdown ni texte autour

FORMAT JSON (tableau plat d'événements) :
[
  {
    "type": "activite" | "transport" | "restauration" | "autre",
    "title": "Nom réel et précis du lieu",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "location": "Adresse complète et précise",
    "rating": "4.X/5",
    "reviewSource": "TripAdvisor" | "Google Maps" | "Lonely Planet" | "Le Routard" | "Time Out" | "Michelin",
    "notes": "Pourquoi y aller, spécialités, ambiance, conseil de réservation",
    "avgMenuPrice": 35,
    "priceRange": "25€ – 45€",
    "priceLevel": "€€",
    "priceSource": "TripAdvisor"
  }
]

RÈGLE PRIX : Pour les événements de type "restauration", TOUJOURS remplir avgMenuPrice (nombre entier en EUR), priceRange, priceLevel et priceSource. Ces champs sont OBLIGATOIRES pour les restaurants. Pour les autres types, omettre ces champs.`;

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
// Body: { destination, startDate, endDate, nbPeople, events, customNotes?, currency? }
// Returns: { categories: [{label, amount, emoji}], total, currency, notes }
router.post("/ai/budget", async (req, res) => {
  try {
    const { destination, startDate, endDate, nbPeople, events, customNotes, currency = "EUR" } = req.body as {
      destination: string;
      startDate: string;
      endDate: string;
      nbPeople: number;
      events: { type: string; title: string }[];
      customNotes?: string;
      currency?: string;
    };

    const dayCount = Math.max(1, Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1);
    const eventSummary = events.map(e => `[${e.type}] ${e.title}`).join(", ") || "Aucun événement planifié";
    const notesSection = customNotes?.trim() ? `\nInformations complémentaires fournies par l'utilisateur : ${customNotes.trim()}` : "";

    const prompt = `Tu es un expert en budget voyage. Estime le budget TOTAL pour un voyage à "${destination}" du ${startDate} au ${endDate} (${dayCount} jours) pour ${nbPeople} personne(s).

Événements planifiés : ${eventSummary}${notesSection}

DEVISE DEMANDÉE : ${currency} — Tous les montants DOIVENT être en ${currency}. Le champ "currency" doit être exactement "${currency}".

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "currency": "${currency}",
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

// POST /api/ai/restaurant-price
// Body: { name, city, country, cuisine?, restoType? }
// Returns: { avgMenuPrice, priceRange, currency, source, priceLevel }
router.post("/ai/restaurant-price", async (req, res) => {
  try {
    const { name, city, country, cuisine, restoType } = req.body as {
      name: string;
      city: string;
      country: string;
      cuisine?: string;
      restoType?: string;
    };

    if (!name || !city) {
      res.status(400).json({ error: "name et city sont requis" });
      return;
    }

    const restoDesc = [restoType, cuisine].filter(Boolean).join(", ") || "restaurant";

    const prompt = `Tu es un expert gastronomique et tu connais parfaitement les prix des restaurants dans le monde entier. Tu t'appuies sur TripAdvisor, Google Maps, TheFork, les sites officiels des restaurants et les guides gastronomiques.

RESTAURANT : "${name}"
VILLE : ${city}${country ? `, ${country}` : ""}
TYPE : ${restoDesc}

MISSION : Estime le prix moyen d'un menu complet (plat principal + éventuellement entrée/dessert) dans ce restaurant. Si tu connais ce restaurant précisément, donne les prix réels. Sinon, estime selon le type d'établissement et la ville.

Réponds UNIQUEMENT en JSON valide sans markdown :
{
  "avgMenuPrice": 25,
  "priceRange": "20€ – 35€",
  "currency": "EUR",
  "priceLevel": "€€",
  "source": "TripAdvisor" | "Google Maps" | "TheFork" | "Site officiel" | "Estimation",
  "details": "1 phrase expliquant la fourchette (ex: plat principal entre 18€ et 28€, menus à 35€)"
}

NIVEAUX DE PRIX :
- € : moins de 15€/pers (street food, fast food)
- €€ : 15€ – 35€/pers (restaurant classique)
- €€€ : 35€ – 70€/pers (restaurant gastronomique)
- €€€€ : plus de 70€/pers (haute gastronomie)`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: "Tu es un expert en gastronomie mondiale. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { avgMenuPrice: null, priceRange: "Non disponible", currency: "EUR", priceLevel: "?", source: "Estimation", details: "" };
    }

    res.json(result);
  } catch (err: any) {
    console.error("[ai/restaurant-price]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/transit
// Body: { from, to, city, date? }
// Returns: { itinerary: string, steps: [{mode, line, from, to, duration, instruction}], mapsUrl }
router.post("/ai/transit", async (req, res) => {
  try {
    const { from, to, city } = req.body as { from: string; to: string; city: string };

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from + ", " + city)}&destination=${encodeURIComponent(to + ", " + city)}&travelmode=transit`;

    const prompt = `Propose un itineraire typique en transports en commun de "${from}" a "${to}" a ${city}. Inclus les etapes a pied. Reponds UNIQUEMENT en JSON : {"summary":"...","totalDuration":"...","steps":[{"mode":"metro|bus|tram|rer|train|marche|ferry|autre","emoji":"...","line":"...","from":"...","to":"...","duration":"...","instruction":"..."}],"tips":"..."}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 5000,
      messages: [
        { role: "system", content: "Assistant voyage. JSON uniquement, pas de markdown." },
        { role: "user", content: prompt },
      ],
    });

    const choice = completion.choices[0];
    const raw = choice?.message?.content?.trim() ?? "";
    console.log("[ai/transit] finish_reason:", choice?.finish_reason, "len:", raw.length, "raw:", raw.slice(0, 300));

    let result: any = {};
    if (raw) {
      try {
        // Strip markdown code fences if present
        const cleaned = raw
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```\s*$/i, "")
          .trim();
        // Find the JSON object boundaries robustly
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          result = JSON.parse(cleaned.slice(start, end + 1));
        } else {
          throw new Error("No JSON object found");
        }
      } catch (parseErr) {
        console.error("[ai/transit] JSON parse error:", (parseErr as Error).message, "raw:", raw.slice(0, 300));
        result = { summary: "Erreur de format — réessayez.", steps: [], tips: "" };
      }
    } else {
      console.error("[ai/transit] Empty response from model");
      result = { summary: "Réponse vide du service IA — réessayez.", steps: [], tips: "" };
    }

    // Always inject our pre-computed mapsUrl
    result.mapsUrl = mapsUrl;

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

    const prompt = `Tu es l'assistant de voyage Ready2Go, incarné par la Boussole. Tu connais parfaitement Ticketmaster, Eventbrite, Songkick, Bandsintown, les comptes Instagram/Facebook/TikTok officiels des artistes et des villes, les offices du tourisme, les clubs sportifs, et les agendas culturels locaux.

MISSION : Identifier les événements incontournables autour de ${destination} (rayon 50 km) entre le ${startDate} et le ${endDate}.

RÈGLE D'OR — NE JAMAIS RÉPONDRE VIDE :
Tu DOIS toujours trouver quelque chose. Voici la hiérarchie à appliquer dans l'ordre :
1. Événements confirmés (concerts, matchs, festivals annoncés sur Ticketmaster/Eventbrite/réseaux sociaux)
2. Événements récurrents à cette période (fêtes nationales, marchés hebdomadaires, matchs de championnat selon la saison, festivals annuels)
3. Expositions temporaires ou longue durée dans les musées locaux
4. Expériences uniques "du moment" : visite nocturne, spectacle de rue régulier, événement gastronomique, marché artisanal
5. EN DERNIER RECOURS : Transformer un POI permanent en expérience incontournable (ex : "Coucher de soleil depuis le belvédère X — unique en cette saison")

TYPES D'ÉVÉNEMENTS :
Concerts, festivals musicaux, matchs sportifs, tournois, Grands Prix, carnavals, fêtes locales, braderies, marchés thématiques, expositions, spectacles de rue, sons et lumières, feux d'artifice, fêtes régionales.

CONTRAINTES :
- Minimum 8 suggestions — INTERDIT d'en retourner moins
- 1 événement "incontournable" mis en avant (le plus exceptionnel/unique)
- Adresse précise pour chaque lieu
- Distance estimée depuis ${destination}
- Source vérifiable (Ticketmaster, TripAdvisor, Google, Eventbrite, Instagram, Office du tourisme…)
- Réponds UNIQUEMENT en JSON valide, sans markdown

FORMAT JSON :
{
  "incontournable": {
    "titre": "Nom de l'événement ou de l'expérience",
    "description": "2 lignes engageantes expliquant pourquoi c'est unique à ces dates",
    "dates": "Date(s) et horaire(s)",
    "source": "Ticketmaster" | "Instagram" | "Office du tourisme" | "TripAdvisor" | autre,
    "category": "concert" | "sport" | "festival" | "exposition" | "expérience" | autre
  },
  "events": [
    {
      "category": "concert" | "sport" | "festival" | "carnaval" | "marché" | "exposition" | "spectacle" | "fête" | "expérience",
      "title": "Nom précis",
      "venue": "Nom du lieu",
      "date": "YYYY-MM-DD",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "location": "Adresse complète",
      "distance": "XX km",
      "rating": "4.X/5",
      "reviewSource": "Ticketmaster" | "TripAdvisor" | "Google" | "Eventbrite" | "Instagram" | "Office du tourisme" | "Notoriété locale",
      "notes": "Artiste/équipe/thème, ambiance, billetterie, pourquoi y aller",
      "type": "activite"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 3000,
      messages: [
        { role: "system", content: "Tu es un expert en événements culturels et touristiques. Tu réponds UNIQUEMENT en JSON valide, sans markdown." },
        { role: "user", content: prompt },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let incontournable: any = null;
    let events: any[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        events = parsed;
      } else {
        incontournable = parsed.incontournable ?? null;
        events = Array.isArray(parsed.events) ? parsed.events : [];
      }
    } catch {
      events = [];
    }

    res.json({ incontournable, events });
  } catch (err: any) {
    console.error("[ai/events-nearby]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

export default router;
