import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as gdb from "../github-db";

const CreateTripBody = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  description: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
});

const CreateEventBody = z.object({
  type: z.enum(["activite", "transport", "logement", "reunion", "restauration", "autre"]),
  title: z.string().min(1),
  location: z.string().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pricePerPerson: z.number().optional().nullable(),
  priceType: z.string().optional().nullable(),
  transportData: z.record(z.string(), z.any()).optional().nullable(),
  lodgingData: z.record(z.string(), z.any()).optional().nullable(),
  restaurationData: z.record(z.string(), z.any()).optional().nullable(),
  activiteData: z.record(z.string(), z.any()).optional().nullable(),
  forAll: z.boolean().optional().default(false),
  participantIds: z.array(z.number()).optional().nullable(),
});

const UpdateEventBody = z.object({
  title: z.string().min(1).optional(),
  date: z.string().optional(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  pricePerPerson: z.number().optional().nullable(),
  priceType: z.string().optional().nullable(),
  transportData: z.record(z.string(), z.any()).optional().nullable(),
  lodgingData: z.record(z.string(), z.any()).optional().nullable(),
  restaurationData: z.record(z.string(), z.any()).optional().nullable(),
  activiteData: z.record(z.string(), z.any()).optional().nullable(),
  forAll: z.boolean().optional(),
  participantIds: z.array(z.number()).optional().nullable(),
});

const UpdateMemberRoleBody = z.object({
  role: z.enum(["member", "admin"]),
});

const JoinTripBody = z.object({
  inviteCode: z.string().min(1),
});

const ChatMessageBody = z.object({
  content: z.string().min(1).max(2000),
});

const router: IRouter = Router();

function parseParam(val: string | string[]): string {
  return Array.isArray(val) ? val[0] ?? "" : val;
}

function requireTripMember(req: Request, res: Response, next: NextFunction): void {
  const tripId = parseInt(parseParam(req.params.tripId));
  const userId = req.user!.userId;

  if (!tripId) { res.status(400).json({ error: "tripId invalide" }); return; }

  gdb.isMember(tripId, userId).then((ok) => {
    if (!ok) {
      res.status(403).json({ error: "Accès refusé — vous n'êtes pas membre de ce voyage." });
    } else {
      next();
    }
  }).catch(() => {
    res.status(500).json({ error: "Erreur serveur" });
  });
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ─── Location (in-memory, ephemeral) ─────────────────────────────────────────
type LocEntry = { userId: number; username: string; lat: number; lng: number; updatedAt: number };
const tripLocs = new Map<number, Map<number, LocEntry>>();
const LOC_TTL = 2 * 60 * 1000;

router.post("/trips/:tripId/location", requireAuth, requireTripMember, (req, res) => {
  const tripId = parseInt(parseParam(req.params.tripId));
  const { lat, lng } = req.body;
  const { userId, username } = req.user!;
  if (lat == null || lng == null) { res.status(400).json({ error: "Données manquantes" }); return; }
  if (!tripLocs.has(tripId)) tripLocs.set(tripId, new Map());
  tripLocs.get(tripId)!.set(userId, { userId, username, lat: Number(lat), lng: Number(lng), updatedAt: Date.now() });
  res.json({ ok: true });
});

router.delete("/trips/:tripId/location", requireAuth, requireTripMember, (req, res) => {
  const tripId = parseInt(parseParam(req.params.tripId));
  tripLocs.get(tripId)?.delete(req.user!.userId);
  res.json({ ok: true });
});

router.get("/trips/:tripId/locations", requireAuth, requireTripMember, (req, res) => {
  const tripId = parseInt(parseParam(req.params.tripId));
  const now = Date.now();
  const locs = tripLocs.get(tripId);
  if (!locs) { res.json([]); return; }
  const active = [...locs.values()].filter((l) => now - l.updatedAt < LOC_TTL);
  for (const [uid, l] of locs.entries()) {
    if (now - l.updatedAt >= LOC_TTL) locs.delete(uid);
  }
  res.json(active);
});

// ─── Trips CRUD ───────────────────────────────────────────────────────────────

router.get("/trips", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const [allMembers, allTrips, allEvents] = await Promise.all([
      gdb.getMembers(),
      gdb.getTrips(),
      gdb.getEvents(),
    ]);

    const userTripIds = new Set(allMembers.filter((m) => m.userId === userId).map((m) => m.tripId));
    if (userTripIds.size === 0) { res.json([]); return; }

    const trips = allTrips.filter((t) => userTripIds.has(t.id));

    const result = trips.map((trip) => {
      const memberCount = allMembers.filter((m) => m.tripId === trip.id).length;
      const eventCount = allEvents.filter((e) => e.tripId === trip.id).length;
      return { ...trip, memberCount, eventCount };
    });

    result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting trips");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trips", requireAuth, async (req, res) => {
  try {
    const body = CreateTripBody.parse(req.body);
    const userId = req.user!.userId;

    let inviteCode = generateInviteCode();
    let existing = await gdb.getTripByInviteCode(inviteCode);
    while (existing) {
      inviteCode = generateInviteCode();
      existing = await gdb.getTripByInviteCode(inviteCode);
    }

    const trip = await gdb.createTrip({
      name: body.name,
      destination: body.destination,
      description: body.description ?? null,
      startDate: body.startDate,
      endDate: body.endDate,
      inviteCode,
      creatorId: userId,
    });

    await gdb.addMember({ tripId: trip.id, userId, role: "admin" });

    res.status(201).json(trip);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }
    req.log.error({ err }, "Error creating trip");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trips/join", requireAuth, async (req, res) => {
  try {
    const body = JoinTripBody.parse(req.body);
    const userId = req.user!.userId;

    const trip = await gdb.getTripByInviteCode(body.inviteCode.toUpperCase());
    if (!trip) { res.status(404).json({ error: "Code d'invitation invalide" }); return; }

    const alreadyMember = await gdb.isMember(trip.id, userId);
    if (alreadyMember) {
      res.status(409).json({ error: "Vous êtes déjà membre de ce voyage" });
      return;
    }

    await gdb.addMember({ tripId: trip.id, userId });
    res.json(trip);
  } catch (err) {
    req.log.error({ err }, "Error joining trip");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.get("/trips/:tripId", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));

    const [trip, members, events, users] = await Promise.all([
      gdb.getTripById(tripId),
      gdb.getTripMembers(tripId),
      gdb.getEventsByTripId(tripId),
      gdb.getUsers(),
    ]);

    if (!trip) { res.status(404).json({ error: "Voyage introuvable" }); return; }

    const userMap = new Map(users.map((u) => [u.id, u.username]));
    const membersWithNames = members.map((m) => ({
      ...m,
      username: userMap.get(m.userId) ?? "Inconnu",
    }));

    events.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

    res.json({ ...trip, members: membersWithNames, events });
  } catch (err) {
    req.log.error({ err }, "Error getting trip");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.delete("/trips/:tripId", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));

    const trip = await gdb.getTripById(tripId);
    if (!trip) { res.status(404).json({ error: "Voyage introuvable" }); return; }

    if (trip.creatorId !== req.user!.userId) {
      res.status(403).json({ error: "Seul le créateur peut supprimer ce voyage." });
      return;
    }

    await gdb.deleteTrip(tripId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting trip");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/trips/:tripId/members", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));

    const [members, users] = await Promise.all([
      gdb.getTripMembers(tripId),
      gdb.getUsers(),
    ]);

    const userMap = new Map(users.map((u) => [u.id, u.username]));
    const membersWithNames = members.map((m) => ({
      ...m,
      username: userMap.get(m.userId) ?? "Inconnu",
    }));

    res.json(membersWithNames);
  } catch (err) {
    req.log.error({ err }, "Error getting members");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/trips/:tripId/events", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));

    const events = await gdb.getEventsByTripId(tripId);
    events.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return (a.startTime ?? "").localeCompare(b.startTime ?? "");
    });

    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Error getting events");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trips/:tripId/events", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const body = CreateEventBody.parse(req.body);
    const userId = req.user!.userId;

    const trip = await gdb.getTripById(tripId);
    if (!trip) { res.status(404).json({ error: "Voyage introuvable" }); return; }

    const event = await gdb.createEvent({
      tripId,
      type: body.type,
      title: body.title,
      location: body.location ?? null,
      date: body.date,
      startTime: body.startTime ?? null,
      endTime: body.endTime ?? null,
      notes: body.notes ?? null,
      pricePerPerson: body.pricePerPerson ?? null,
      priceType: body.priceType ?? null,
      transportData: (body.transportData as Record<string, unknown>) ?? null,
      lodgingData: (body.lodgingData as Record<string, unknown>) ?? null,
      restaurationData: (body.restaurationData as Record<string, unknown>) ?? null,
      activiteData: (body.activiteData as Record<string, unknown>) ?? null,
      forAll: body.forAll ?? false,
      participantIds: body.forAll ? null : (body.participantIds ?? [userId]),
      creatorId: userId,
    });

    res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "Error creating event");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/trips/:tripId/events/:eventId", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const eventId = parseInt(parseParam(req.params.eventId));
    const userId = req.user!.userId;
    const body = UpdateEventBody.parse(req.body);

    const [event, members] = await Promise.all([
      gdb.getEventById(eventId),
      gdb.getTripMembers(tripId),
    ]);
    if (!event || event.tripId !== tripId) {
      res.status(404).json({ error: "Événement introuvable" });
      return;
    }

    const myRole = members.find((m) => m.userId === userId)?.role ?? "member";
    const isAdmin = myRole === "admin";
    const isOwner = event.creatorId === userId;

    if (event.forAll && !isAdmin) {
      res.status(403).json({ error: "Seuls les administrateurs peuvent modifier un événement partagé." });
      return;
    }
    if (!event.forAll && !isAdmin && !isOwner) {
      res.status(403).json({ error: "Vous ne pouvez modifier que vos propres événements." });
      return;
    }

    const patch: Partial<gdb.AppEvent> = {};
    if (body.title !== undefined) patch.title = body.title;
    if (body.date !== undefined) patch.date = body.date;
    if (body.startTime !== undefined) patch.startTime = body.startTime;
    if (body.endTime !== undefined) patch.endTime = body.endTime;
    if (body.location !== undefined) patch.location = body.location;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.pricePerPerson !== undefined) patch.pricePerPerson = body.pricePerPerson;
    if (body.priceType !== undefined) patch.priceType = body.priceType;
    if (body.transportData !== undefined) patch.transportData = body.transportData as Record<string, unknown>;
    if (body.lodgingData !== undefined) patch.lodgingData = body.lodgingData as Record<string, unknown>;
    if (body.restaurationData !== undefined) patch.restaurationData = body.restaurationData as Record<string, unknown>;
    if (body.activiteData !== undefined) patch.activiteData = body.activiteData as Record<string, unknown>;
    if (body.forAll !== undefined && isAdmin) patch.forAll = body.forAll;
    if (body.participantIds !== undefined && isAdmin) patch.participantIds = body.participantIds;

    const updated = await gdb.updateEvent(eventId, patch);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating event");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── Admin: change member role ──────────────────────────────────────────────

router.patch("/trips/:tripId/members/:userId/role", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const targetUserId = parseInt(parseParam(req.params.userId));
    const requesterId = req.user!.userId;
    const body = UpdateMemberRoleBody.parse(req.body);

    const members = await gdb.getTripMembers(tripId);
    const requesterMember = members.find((m) => m.userId === requesterId);
    const targetMember = members.find((m) => m.userId === targetUserId);

    if (!requesterMember || requesterMember.role !== "admin") {
      res.status(403).json({ error: "Seuls les administrateurs peuvent gérer les rôles." });
      return;
    }
    if (!targetMember) {
      res.status(404).json({ error: "Membre introuvable." });
      return;
    }

    const trip = await gdb.getTripById(tripId);
    if (targetUserId === trip?.creatorId && body.role === "member") {
      res.status(403).json({ error: "Le créateur du voyage ne peut pas être rétrogradé." });
      return;
    }

    const adminCount = members.filter((m) => m.role === "admin").length;
    if (body.role === "admin" && adminCount >= 4) {
      res.status(400).json({ error: "Maximum 4 administrateurs par voyage." });
      return;
    }

    const updated = await gdb.updateMemberRole(tripId, targetUserId, body.role);
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Error updating member role");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.delete("/trips/:tripId/events/:eventId", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const eventId = parseInt(parseParam(req.params.eventId));

    const event = await gdb.getEventById(eventId);
    if (!event || event.tripId !== tripId) {
      res.status(404).json({ error: "Événement introuvable" });
      return;
    }

    await gdb.deleteEvent(eventId);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting event");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ─── Trip Chat ─────────────────────────────────────────────────────────────────

router.get("/trips/:tripId/chat", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const msgs = await gdb.getChatMessages(tripId);
    msgs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json(msgs.slice(-200));
  } catch (err) {
    req.log.error({ err }, "Error getting chat");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/trips/:tripId/chat", requireAuth, requireTripMember, async (req, res) => {
  try {
    const tripId = parseInt(parseParam(req.params.tripId));
    const body = ChatMessageBody.parse(req.body);
    const { userId, username } = req.user!;

    const msg = await gdb.addChatMessage({ tripId, userId, username, content: body.content });
    res.status(201).json(msg);
  } catch (err) {
    req.log.error({ err }, "Error posting chat");
    res.status(400).json({ error: "Requête invalide" });
  }
});

export default router;
