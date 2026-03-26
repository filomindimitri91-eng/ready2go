import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateUserBody, GetUserParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/users", async (req, res) => {
  try {
    const body = CreateUserBody.parse(req.body);
    const existing = await db.select().from(usersTable).where(eq(usersTable.username, body.username)).limit(1);
    if (existing.length > 0) {
      res.json(existing[0]);
      return;
    }
    const [user] = await db.insert(usersTable).values({ username: body.username }).returning();
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Error creating user");
    res.status(400).json({ error: "Requête invalide" });
  }
});

router.get("/users/:userId", async (req, res) => {
  try {
    const { userId } = GetUserParams.parse({ userId: req.params.userId });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    res.json(user);
  } catch (err) {
    req.log.error({ err }, "Error getting user");
    res.status(400).json({ error: "Requête invalide" });
  }
});

export default router;
