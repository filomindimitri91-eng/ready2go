import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.use(requireAuth);

// Active AI model — updated each time getOpenAI() resolves
let AI_MODEL = "gemini-2.0-flash";

async function getOpenAI() {
  const { default: OpenAI } = await import("openai");

  // 1. Google Gemini — free (1 500 req/day), no subscription needed
  //    Get a free key at https://aistudio.google.com/
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    AI_MODEL = "gemini-2.0-flash";
    return new OpenAI({
      apiKey: geminiKey,
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    });
  }

  // 2. OpenAI direct key (paid, optional)
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    AI_MODEL = "gpt-4o-mini";
    return new OpenAI({ apiKey: openaiKey });
  }

  // 3. Replit AI proxy — dev environment only
  const replitUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const replitKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (replitUrl && replitKey) {
    AI_MODEL = "gpt-4o-mini";
    return new OpenAI({ apiKey: replitKey, baseURL: replitUrl });
  }

  throw new Error("AI non configuré. Ajoutez GEMINI_API_KEY dans les variables d'environnement.");
}

async function getAudio() {
  const { speechToText, textToSpeech, ensureCompatibleFormat } = await import(
    "@workspace/integrations-openai-ai-server/audio"
  );
  return { speechToText, textToSpeech, ensureCompatibleFormat };
}

function aiUnavailable(res: any) {
  res.status(503).json({ error: "Service IA non configuré sur ce déploiement." });
}

// POST /api/ai/translate
router.post("/ai/translate", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    const audio = await getAudio().catch(() => null);
    if (!openai || !audio) { aiUnavailable(res); return; }

    const { audioBase64, mimeType, targetLang, targetLangName, destination } = req.body as {
      audioBase64: string; mimeType: string; targetLang: string; targetLangName: string; destination: string;
    };

    if (!audioBase64) { res.status(400).json({ error: "audioBase64 est requis" }); return; }

    const rawBuffer = Buffer.from(audioBase64, "base64");
    const { buffer, format } = await audio.ensureCompatibleFormat(rawBuffer);
    const transcription = await audio.speechToText(buffer, format);

    if (!transcription.trim()) {
      res.status(422).json({ error: "Aucune parole détectée dans l'enregistrement." });
      return;
    }

    const translationRes = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [
        { role: "system", content: `Tu es un traducteur expert. Traduis le texte de l'utilisateur en ${targetLangName}. Destination du voyage: ${destination || "inconnue"}. Réponds UNIQUEMENT avec la traduction, sans explication ni ponctuation supplémentaire.` },
        { role: "user", content: transcription },
      ],
    });

    const translation = translationRes.choices[0]?.message?.content?.trim() ?? "";
    const ttsBuffer = await audio.textToSpeech(translation, "nova");
    const audioOut = ttsBuffer.toString("base64");

    res.json({ transcription, translation, audioBase64: audioOut });
  } catch (err: any) {
    console.error("[ai/translate]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/chat (streaming SSE)
router.post("/ai/chat", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { messages, destination, systemPrompt } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
      destination: string; systemPrompt?: string;
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const system = systemPrompt
      ?? `Tu es un assistant de voyage expert et enthousiaste. Le voyage est à destination de : "${destination}". Tu aides les voyageurs à trouver des idées d'activités, de transport, de logement et de restaurants adaptés à leur destination. Réponds toujours en français, de manière concise et pratique. Utilise des emojis pour rendre tes réponses vivantes.`;

    const stream = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: "system", content: system }, ...messages],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) res.write(`data: ${JSON.stringify({ content })}\n\n`);
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
router.post("/ai/generate-program", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { destination, startDate, endDate, existingEvents } = req.body as {
      destination: string; startDate: string; endDate: string;
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
      model: AI_MODEL,
      max_tokens: 3000,
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
    } catch { events = []; }

    res.json({ events });
  } catch (err: any) {
    console.error("[ai/generate-program]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/budget
router.post("/ai/budget", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { destination, startDate, endDate, nbPeople, events, customNotes, currency = "EUR" } = req.body as {
      destination: string; startDate: string; endDate: string; nbPeople: number;
      events: { type: string; title: string }[]; customNotes?: string; currency?: string;
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
      model: AI_MODEL,
      max_tokens: 800,
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
router.post("/ai/restaurant-price", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { name, city, country, cuisine, restoType } = req.body as {
      name: string; city: string; country: string; cuisine?: string; restoType?: string;
    };

    if (!name || !city) { res.status(400).json({ error: "name et city sont requis" }); return; }

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
  "source": "TripAdvisor",
  "details": "1 phrase expliquant la fourchette"
}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 600,
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
router.post("/ai/transit", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { from, to, city } = req.body as { from: string; to: string; city: string };

    const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(from + ", " + city)}&destination=${encodeURIComponent(to + ", " + city)}&travelmode=transit`;

    const prompt = `Propose un itineraire typique en transports en commun de "${from}" a "${to}" a ${city}. Inclus les etapes a pied. Reponds UNIQUEMENT en JSON : {"summary":"...","totalDuration":"...","steps":[{"mode":"metro|bus|tram|rer|train|marche|ferry|autre","emoji":"...","line":"...","from":"...","to":"...","duration":"...","instruction":"..."}],"tips":"..."}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 5000,
      messages: [
        { role: "system", content: "Assistant voyage. JSON uniquement, pas de markdown." },
        { role: "user", content: prompt },
      ],
    });

    const choice = completion.choices[0];
    const raw = choice?.message?.content?.trim() ?? "";

    let result: any = {};
    if (raw) {
      try {
        const cleaned = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "").trim();
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start !== -1 && end !== -1) {
          result = JSON.parse(cleaned.slice(start, end + 1));
        } else throw new Error("No JSON object found");
      } catch {
        result = { summary: "Erreur de format — réessayez.", steps: [], tips: "" };
      }
    } else {
      result = { summary: "Réponse vide du service IA — réessayez.", steps: [], tips: "" };
    }

    result.mapsUrl = mapsUrl;
    res.json(result);
  } catch (err: any) {
    console.error("[ai/transit]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/events-nearby
router.post("/ai/events-nearby", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { destination, startDate, endDate } = req.body as {
      destination: string; startDate: string; endDate: string;
    };

    const prompt = `Tu es l'assistant de voyage Ready2Go, incarné par la Boussole. Tu connais parfaitement Ticketmaster, Eventbrite, Songkick, Bandsintown, les comptes Instagram/Facebook/TikTok officiels des artistes et des villes, les offices du tourisme, les clubs sportifs, et les agendas culturels locaux.

MISSION : Identifier les événements incontournables autour de ${destination} (rayon 50 km) entre le ${startDate} et le ${endDate}.

RÈGLE D'OR — NE JAMAIS RÉPONDRE VIDE :
Tu DOIS toujours trouver quelque chose. Voici la hiérarchie à appliquer dans l'ordre :
1. Événements confirmés (concerts, matchs, festivals annoncés sur Ticketmaster/Eventbrite/réseaux sociaux)
2. Événements récurrents à cette période (fêtes nationales, marchés hebdomadaires, matchs de championnat selon la saison, festivals annuels)
3. Expositions temporaires ou longue durée dans les musées locaux
4. Expériences uniques "du moment" : visite nocturne, spectacle de rue régulier, événement gastronomique, marché artisanal
5. EN DERNIER RECOURS : Transformer un POI permanent en expérience incontournable

CONTRAINTES :
- Minimum 8 suggestions — INTERDIT d'en retourner moins
- Adresse précise pour chaque lieu
- Source vérifiable
- Réponds UNIQUEMENT en JSON valide, sans markdown

FORMAT JSON :
{
  "incontournable": { "titre": "...", "description": "...", "dates": "...", "source": "...", "category": "..." },
  "events": [
    {
      "category": "concert|sport|festival|carnaval|marché|exposition|spectacle|fête|expérience",
      "title": "...", "venue": "...", "date": "YYYY-MM-DD", "startTime": "HH:MM", "endTime": "HH:MM",
      "location": "...", "distance": "XX km", "rating": "4.X/5", "reviewSource": "...",
      "notes": "...", "type": "activite"
    }
  ]
}`;

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 3000,
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
    } catch { events = []; }

    res.json({ incontournable, events });
  } catch (err: any) {
    console.error("[ai/events-nearby]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/import-reservation
router.post("/ai/import-reservation", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { mode, imageBase64, mimeType, emailText, reservationNumber, provider, tripStartDate } = req.body as {
      mode: "file" | "text" | "email";
      imageBase64?: string;
      mimeType?: string;
      emailText?: string;
      reservationNumber?: string;
      provider?: string;
      tripStartDate?: string;
    };

    const jsonSchema = `{
  "eventType": "transport" | "logement" | "restauration" | "activite" | "autre",
  "title": "Nom court et clair de l'événement",
  "date": "YYYY-MM-DD (date principale de l'événement)",
  "startTime": "HH:MM ou null",
  "endTime": "HH:MM ou null",
  "location": "adresse ou lieu ou null",
  "notes": "informations complémentaires ou null",
  "pricePerPerson": nombre ou null,
  "bookingReference": "numéro de réservation ou null",
  "providerName": "nom du site/prestataire ou null",
  "transportData": { "transportType": "plane|train|bus|ferry|carRental|taxi|metro|other", "provider": "...", "vehicleNumber": "...", "departureLocation": "...", "arrivalLocation": "...", "departureTime": "HH:MM", "arrivalTime": "HH:MM", "arrivalDate": "YYYY-MM-DD ou null", "seat": "...", "bookingReference": "..." } ou null,
  "lodgingData": { "lodgingType": "hotel|airbnb|rental|camping|hostel|guesthouse|other", "name": "...", "address": "...", "city": "...", "country": "...", "checkInDate": "YYYY-MM-DD", "checkInTime": "HH:MM", "checkOutDate": "YYYY-MM-DD", "checkOutTime": "HH:MM", "bookingProvider": "...", "bookingReference": "...", "roomType": "..." } ou null,
  "restaurationData": { "restoType": "restaurant|brasserie|bistrot|cafe|fastFood|gastronomique|pizzeria|sushi|other", "name": "...", "address": "...", "city": "...", "guestCount": nombre, "bookingReference": "..." } ou null,
  "activiteData": { "activiteType": "visite|musee|randonnee|plage|sport|concert|spectacle|parc|autre", "name": "...", "address": "...", "city": "..." } ou null,
  "summary": "Résumé humain en 1 phrase (ex: Hôtel à Paris du 10 au 15 juin, réf: ABC123)",
  "confidence": 0.0 à 1.0,
  "detected": { "Champ humain": "Valeur détectée", ... }
}`;

    let messages: any[];
    const isEmail = mode === "email" || (mode === "text" && !imageBase64);
    const isFile = (mode === "file") && imageBase64 && mimeType;
    const isPdf = isFile && mimeType === "application/pdf";

    if (isPdf) {
      const _pdfMod: any = await import("pdf-parse"); const pdfParse: any = _pdfMod.default ?? _pdfMod;
      const pdfBuffer = Buffer.from(imageBase64!, "base64");
      let pdfText = "";
      try {
        const parsed = await pdfParse(pdfBuffer);
        pdfText = parsed.text?.trim() ?? "";
      } catch {
        pdfText = "";
      }
      const context = [
        pdfText ? `CONTENU DU PDF :\n${pdfText}` : "PDF illisible ou vide.",
        tripStartDate ? `DATE DU VOYAGE (référence) : ${tripStartDate}` : null,
      ].filter(Boolean).join("\n\n");
      messages = [
        {
          role: "system",
          content: "Tu es un expert en analyse de documents de voyage (PDF de billets, confirmations). Extrais les informations structurées. Réponds UNIQUEMENT en JSON valide sans markdown.",
        },
        {
          role: "user",
          content: `Analyse ce document PDF de voyage et extrais les données :\n\n${context}\n\nRéponds UNIQUEMENT en JSON avec ce schéma :\n${jsonSchema}`,
        },
      ];
    } else if (isFile) {
      messages = [
        {
          role: "system",
          content: `Tu es un expert en analyse de documents de voyage (billets, confirmations de réservation, e-tickets). Extrais les informations structurées de l'image. Réponds UNIQUEMENT en JSON valide sans markdown. Date du voyage (si non trouvée dans l'image) : ${tripStartDate ?? "inconnue"}.`,
        },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: `Analyse ce document de voyage et extrais toutes les informations. Réponds UNIQUEMENT en JSON valide avec ce schéma :\n${jsonSchema}` },
          ],
        },
      ];
    } else {
      const context = [
        emailText ? `EMAIL DE CONFIRMATION :\n${emailText}` : null,
        reservationNumber ? `NUMÉRO DE RÉSERVATION : ${reservationNumber}` : null,
        provider ? `SITE / PRESTATAIRE : ${provider}` : null,
        tripStartDate ? `DATE DU VOYAGE (référence) : ${tripStartDate}` : null,
      ].filter(Boolean).join("\n\n");

      messages = [
        {
          role: "system",
          content: "Tu es un expert en analyse de confirmations de voyage. Extrais les informations structurées. Réponds UNIQUEMENT en JSON valide sans markdown.",
        },
        {
          role: "user",
          content: `Analyse ces informations de réservation et extrais les données structurées :\n\n${context}\n\nRéponds UNIQUEMENT en JSON avec ce schéma :\n${jsonSchema}`,
        },
      ];
    }

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 2000,
      messages,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = {
        eventType: "autre",
        title: "Réservation importée",
        date: tripStartDate ?? new Date().toISOString().slice(0, 10),
        summary: "Impossible d'analyser le document.",
        confidence: 0,
        detected: {},
      };
    }

    if (!result.date) result.date = tripStartDate ?? new Date().toISOString().slice(0, 10);
    if (!result.eventType) result.eventType = "autre";
    if (!result.title) result.title = "Réservation importée";

    res.json(result);
  } catch (err: any) {
    console.error("[ai/import-reservation]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// POST /api/ai/parse-trip
// Analyse un document pour pré-remplir les infos du voyage + créer l'événement initial
router.post("/ai/parse-trip", async (req, res) => {
  try {
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { aiUnavailable(res); return; }

    const { mode, imageBase64, mimeType, emailText } = req.body as {
      mode: "file" | "email";
      imageBase64?: string;
      mimeType?: string;
      emailText?: string;
    };

    const jsonSchema = `{
  "trip": {
    "name": "Nom court du voyage (ex: Séjour à Paris, Week-end à Rome)",
    "destination": "Ville principale, Pays (ex: Paris, France)",
    "startDate": "YYYY-MM-DD (premier jour du séjour)",
    "endDate": "YYYY-MM-DD (dernier jour du séjour)"
  },
  "event": {
    "eventType": "transport" | "logement" | "restauration" | "activite" | "autre",
    "title": "Nom court de l'événement",
    "date": "YYYY-MM-DD",
    "startTime": "HH:MM ou null",
    "endTime": "HH:MM ou null",
    "location": "adresse ou lieu ou null",
    "notes": "informations complémentaires ou null",
    "pricePerPerson": nombre ou null,
    "bookingReference": "référence de réservation ou null",
    "providerName": "nom du prestataire ou null",
    "transportData": { "transportType": "plane|train|bus|ferry|carRental|taxi|metro|other", "provider": "...", "vehicleNumber": "...", "departureLocation": "...", "arrivalLocation": "...", "departureTime": "HH:MM", "arrivalTime": "HH:MM", "arrivalDate": "YYYY-MM-DD ou null", "seat": "...", "bookingReference": "..." } ou null,
    "lodgingData": { "lodgingType": "hotel|airbnb|rental|camping|hostel|guesthouse|other", "name": "...", "address": "...", "city": "...", "country": "...", "checkInDate": "YYYY-MM-DD", "checkInTime": "HH:MM", "checkOutDate": "YYYY-MM-DD", "checkOutTime": "HH:MM", "bookingProvider": "...", "bookingReference": "...", "roomType": "..." } ou null,
    "restaurationData": null,
    "activiteData": null
  },
  "confidence": 0.0 à 1.0
}`;

    const sysPrompt = "Tu es un assistant d'analyse de documents de voyage. Extrais les informations clés pour créer un voyage et son premier événement. Réponds UNIQUEMENT en JSON valide sans markdown.";

    let messages: any[];
    const isPdf = mode === "file" && mimeType === "application/pdf";

    if (isPdf && imageBase64) {
      const _pdfMod: any = await import("pdf-parse"); const pdfParse: any = _pdfMod.default ?? _pdfMod;
      const pdfBuffer = Buffer.from(imageBase64, "base64");
      let pdfText = "";
      try { const parsed = await pdfParse(pdfBuffer); pdfText = parsed.text?.trim() ?? ""; } catch { pdfText = ""; }
      messages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Analyse ce document de voyage et remplis le JSON :\n\n${pdfText || "PDF illisible"}\n\nRéponds UNIQUEMENT en JSON :\n${jsonSchema}` },
      ];
    } else if (mode === "file" && imageBase64 && mimeType) {
      messages = [
        { role: "system", content: sysPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: "auto" } },
            { type: "text", text: `Analyse ce document de voyage et remplis le JSON :\n${jsonSchema}` },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: sysPrompt },
        { role: "user", content: `Analyse cet e-mail de réservation et remplis le JSON :\n\n${emailText ?? ""}\n\nRéponds UNIQUEMENT en JSON :\n${jsonSchema}` },
      ];
    }

    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 1500,
      messages,
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "{}";
    let result: any = {};
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      result = { trip: {}, event: {}, confidence: 0 };
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!result.trip) result.trip = {};
    if (!result.event) result.event = {};
    if (!result.trip.startDate) result.trip.startDate = today;
    if (!result.trip.endDate) result.trip.endDate = result.trip.startDate;
    if (!result.event.date) result.event.date = result.trip.startDate;
    if (!result.event.eventType) result.event.eventType = "autre";
    if (!result.event.title) result.event.title = "Réservation importée";

    res.json(result);
  } catch (err: any) {
    console.error("[ai/parse-trip]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur" });
  }
});

// ─── In-memory cache for travel news (30 min TTL) ────────────────────────────
const newsCache = new Map<string, { ts: number; items: any[] }>();
const NEWS_TTL = 30 * 60 * 1000;

function classifyNewsItem(title: string): string {
  const t = title.toLowerCase();
  if (/grève|strike|perturbation|retard|annulé|fermeture|alerte|incident/.test(t)) return "alert";
  if (/sncf|tgv|ter|izy|eurostar|air france|vueling|easyjet|ryanair|transavia|metro|rer|bus|tram|avion|vol\b|aéroport|gare/.test(t)) return "transport";
  if (/météo|pluie|orage|chaleur|neige|vent|inondation|sécheresse|canicule/.test(t)) return "weather";
  if (/festival|concert|exposition|match|spectacle|événement|fête|carnaval/.test(t)) return "event";
  return "info";
}

async function fetchGoogleNewsRSS(query: string): Promise<any[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Ready2Go/1.0)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`RSS fetch failed: ${res.status}`);
  const xml = await res.text();
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const titleMatch = /<title>([\s\S]*?)<\/title>/.exec(block);
    const linkMatch  = /<link>([\s\S]*?)<\/link>/.exec(block);
    if (!titleMatch) continue;
    const title = titleMatch[1]
      .replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/\s*-\s*[^-]+$/, "") // strip " - Source Name" suffix
      .trim();
    if (!title || title.toLowerCase().includes("google news")) continue;
    const url = linkMatch ? linkMatch[1].trim() : undefined;
    items.push({ title, category: classifyNewsItem(title), url });
    if (items.length >= 10) break;
  }
  return items;
}

// POST /api/ai/travel-news
router.post("/ai/travel-news", async (req, res) => {
  try {
    const { destination, operators = [] } = req.body as {
      destination: string;
      operators?: string[];
    };
    if (!destination) { res.status(400).json({ error: "destination requis" }); return; }

    const cacheKey = `${destination}:${operators.join(",")}`.toLowerCase();
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < NEWS_TTL) {
      res.json({ items: cached.items, source: "cache" });
      return;
    }

    // Build RSS query: destination + operator names
    const city = destination.split(",")[0].trim();
    const opStr = operators.slice(0, 2).join(" ").trim();
    const query = [city, "transport", "voyage", opStr].filter(Boolean).join(" ");

    let items: any[] = [];
    try {
      items = await fetchGoogleNewsRSS(query);
    } catch (rssErr) {
      console.warn("[travel-news] RSS fetch failed:", (rssErr as Error).message);
    }

    // If RSS gave nothing, try AI fallback
    if (items.length === 0) {
      const openai = await getOpenAI().catch(() => null);
      if (openai) {
        const opList = operators.length ? `Opérateurs concernés : ${operators.join(", ")}.` : "";
        const completion = await openai.chat.completions.create({
          model: AI_MODEL,
          max_tokens: 600,
          messages: [
            { role: "system", content: "Tu es un agrégateur d'actualités voyage. Génère des titres d'actualité plausibles et concis (max 90 chars chacun). Réponds UNIQUEMENT en JSON." },
            { role: "user", content: `Génère 6 titres d'actualité pouvant impacter des voyageurs à destination de ${destination}. ${opList} Inclus : grèves/perturbations transports, météo, événements locaux, alertes sécurité si pertinentes. Format : {"items":[{"title":"...","category":"alert|transport|weather|event|info"}]}` },
          ],
        });
        const raw = completion.choices[0]?.message?.content?.trim() ?? "";
        try {
          const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
          const parsed = JSON.parse(cleaned);
          items = Array.isArray(parsed.items) ? parsed.items : [];
        } catch { items = []; }
      }
    }

    if (items.length > 0) {
      newsCache.set(cacheKey, { ts: Date.now(), items });
    }

    res.json({ items, source: items.length > 0 ? "live" : "empty" });
  } catch (err: any) {
    console.error("[ai/travel-news]", err);
    res.status(500).json({ error: err?.message ?? "Erreur serveur", items: [] });
  }
});

// ── /api/ai/travel-tips ──────────────────────────────────────────────────────
const tipsCache = new Map<string, { ts: number; tips: string[] }>();
const TIPS_TTL = 60 * 60 * 1000; // 1h

router.post("/ai/travel-tips", async (req, res) => {
  try {
    const { destination } = req.body as { destination?: string };
    if (!destination) { res.status(400).json({ tips: [] }); return; }
    const key = destination.toLowerCase().trim();
    const cached = tipsCache.get(key);
    if (cached && Date.now() - cached.ts < TIPS_TTL) { res.json({ tips: cached.tips }); return; }
    const openai = await getOpenAI().catch(() => null);
    if (!openai) { res.json({ tips: [] }); return; }
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      max_tokens: 500,
      messages: [
        { role: "system", content: "Tu es un expert conseiller voyage. Génère des conseils pratiques, courts, concrets et utiles pour voyageurs. Réponds UNIQUEMENT en JSON valide." },
        { role: "user", content: `Génère 4 conseils pour un voyageur se rendant à ${destination}. Axe sur : pièges fréquents (transports, arnaques, météo), astuces locales, problèmes courants rapportés par les voyageurs. Chaque conseil : max 95 caractères, en français, commence par un emoji. Format : {"tips":["...","...","...","..."]}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    let tips: string[] = [];
    try {
      const cleaned = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
      tips = JSON.parse(cleaned).tips ?? [];
    } catch { tips = []; }
    if (tips.length > 0) tipsCache.set(key, { ts: Date.now(), tips });
    res.json({ tips });
  } catch (err: any) {
    console.error("[ai/travel-tips]", err);
    res.status(500).json({ tips: [] });
  }
});

export default router;

