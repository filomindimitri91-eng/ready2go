import { Router, type IRouter } from "express";
import { db, tripsTable, tripMembersTable, usersTable, eventsTable } from "@workspace/db";
import { eq, and, count, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  GetTripsQueryParams,
  GetTripParams,
  DeleteTripParams,
  JoinTripBody,
  GetTripMembersParams,
  GetTripEventsParams,
  CreateEventParams,
  DeleteEventParams,
} from "@workspace/api-zod";

const CreateTripBody = z.object({
  name: z.string().min(1),
  destination: z.string().min(1),
  description: z.string().optional().nullable(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  creatorId: z.coerce.number().int(),
});

const CreateEventBody = z.object({
  type: z.enum(["activite", "transport", "logement", "reunion", "restauration", "autre"]),
  title: z.string().min(1),
  location: z.string().optional().nullable(),
  date: z.string().min(1),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  creatorId: z.coerce.number().int(),
  transportData: z.record(z.string(), z.any()).optional().nullable(),
  lodgingData: z.record(z.string(), z.any()).optional().nullable(),
  restaurationData: z.record(z.string(), z.any()).optional().nullable(),
});

const router: IRouter = Router();

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

router.get("/trips", async (req, res) => {
  try {
    const { userId } = GetTripsQueryParams.parse(req.query);

    const memberRows = await db
      .select({ tripId: tripMembersTable.tripId })
      .from(tripMembersTable)
      .where(eq(tripMembersTable.userId, userId));

    const tripIds = memberRows.map((r) => r.tripId);
    if (tripIds.length === 0) {
      res.json([]);
      return;
    }

    const trips = await db.select().from(tripsTable).where(inArray(tripsTable.id, tripIds));

    const result = await Promise.all(
      trips.map(async (trip) => {
        const [{ value: memberCount }] = await db
          .select({ value: count() })
          .from(tripMembersTable)
          .where(eq(tripMembersTable.tripId, trip.id));

        const [{ value: eventCount }] = await db
          .select({ value: count() })
          .from(eventsTable)
          .where(eq(eventsTable.tripId, trip.id));

        return {
          ...trip,
          memberCount: Number(memberCount),
          eventCount: Number(eventCount),
        };
      }),
    );

    result.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Error getting trips");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.post("/trips", async (req, res) => {
  try {
    const body = CreateTripBody.parse(req.body);

    let inviteCode = generateInviteCode();
    let exists = true;
    while (exists) {
      const rows = await db.select().from(tripsTable).where(eq(tripsTable.inviteCode, inviteCode)).limit(1);
      if (rows.length === 0) exists = false;
      else inviteCode = generateInviteCode();
    }

    const [trip] = await db
      .insert(tripsTable)
      .values({
        name: body.name,
        destination: body.destination,
        description: body.description ?? null,
        startDate: body.startDate,
        endDate: body.endDate,
        inviteCode,
        creatorId: body.creatorId,
      })
      .returning();

    await db.insert(tripMembersTable).values({ tripId: trip.id, userId: body.creatorId });

    res.status(201).json(trip);
  } catch (err) {
    req.log.error({ err }, "Error creating trip");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.post("/trips/join", async (req, res) => {
  try {
    const body = JoinTripBody.parse(req.body);

    const [trip] = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.inviteCode, body.inviteCode.toUpperCase()))
      .limit(1);

    if (!trip) {
      res.status(404).json({ error: "Code d'invitation invalide" });
      return;
    }

    const existing = await db
      .select()
      .from(tripMembersTable)
      .where(and(eq(tripMembersTable.tripId, trip.id), eq(tripMembersTable.userId, body.userId)))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: "Vous êtes déjà membre de ce voyage" });
      return;
    }

    await db.insert(tripMembersTable).values({ tripId: trip.id, userId: body.userId });
    res.json(trip);
  } catch (err) {
    req.log.error({ err }, "Error joining trip");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.get("/trips/:tripId", async (req, res) => {
  try {
    const { tripId } = GetTripParams.parse({ tripId: req.params.tripId });

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) {
      res.status(404).json({ error: "Voyage introuvable" });
      return;
    }

    const membersWithNames = await db
      .select({
        id: tripMembersTable.id,
        userId: tripMembersTable.userId,
        tripId: tripMembersTable.tripId,
        username: usersTable.username,
        joinedAt: tripMembersTable.joinedAt,
      })
      .from(tripMembersTable)
      .innerJoin(usersTable, eq(tripMembersTable.userId, usersTable.id))
      .where(eq(tripMembersTable.tripId, tripId));

    const events = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.tripId, tripId))
      .orderBy(eventsTable.date, eventsTable.startTime);

    res.json({
      ...trip,
      members: membersWithNames,
      events,
    });
  } catch (err) {
    req.log.error({ err }, "Error getting trip");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.delete("/trips/:tripId", async (req, res) => {
  try {
    const { tripId } = DeleteTripParams.parse({ tripId: req.params.tripId });

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) {
      res.status(404).json({ error: "Voyage introuvable" });
      return;
    }

    await db.delete(tripsTable).where(eq(tripsTable.id, tripId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting trip");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.get("/trips/:tripId/members", async (req, res) => {
  try {
    const { tripId } = GetTripMembersParams.parse({ tripId: req.params.tripId });

    const members = await db
      .select({
        id: tripMembersTable.id,
        userId: tripMembersTable.userId,
        tripId: tripMembersTable.tripId,
        username: usersTable.username,
        joinedAt: tripMembersTable.joinedAt,
      })
      .from(tripMembersTable)
      .innerJoin(usersTable, eq(tripMembersTable.userId, usersTable.id))
      .where(eq(tripMembersTable.tripId, tripId));

    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Error getting members");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.get("/trips/:tripId/events", async (req, res) => {
  try {
    const { tripId } = GetTripEventsParams.parse({ tripId: req.params.tripId });

    const events = await db
      .select()
      .from(eventsTable)
      .where(eq(eventsTable.tripId, tripId))
      .orderBy(eventsTable.date, eventsTable.startTime);

    res.json(events);
  } catch (err) {
    req.log.error({ err }, "Error getting events");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.post("/trips/:tripId/events", async (req, res) => {
  try {
    const { tripId } = CreateEventParams.parse({ tripId: req.params.tripId });
    const body = CreateEventBody.parse(req.body);

    const [trip] = await db.select().from(tripsTable).where(eq(tripsTable.id, tripId)).limit(1);
    if (!trip) {
      res.status(404).json({ error: "Voyage introuvable" });
      return;
    }

    const [event] = await db
      .insert(eventsTable)
      .values({
        tripId,
        type: body.type,
        title: body.title,
        location: body.location ?? null,
        date: body.date,
        startTime: body.startTime ?? null,
        endTime: body.endTime ?? null,
        notes: body.notes ?? null,
        transportData: body.transportData ?? null,
        lodgingData: body.lodgingData ?? null,
        restaurationData: body.restaurationData ?? null,
        creatorId: body.creatorId,
      })
      .returning();

    res.status(201).json(event);
  } catch (err) {
    req.log.error({ err }, "Error creating event");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.delete("/trips/:tripId/events/:eventId", async (req, res) => {
  try {
    const { tripId, eventId } = DeleteEventParams.parse({
      tripId: req.params.tripId,
      eventId: req.params.eventId,
    });

    const [event] = await db
      .select()
      .from(eventsTable)
      .where(and(eq(eventsTable.id, eventId), eq(eventsTable.tripId, tripId)))
      .limit(1);

    if (!event) {
      res.status(404).json({ error: "Événement introuvable" });
      return;
    }

    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Error deleting event");
    res.status(400).json({ error: "Requête invalide" });
  }
});

export default router;
