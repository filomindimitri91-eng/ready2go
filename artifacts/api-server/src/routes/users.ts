import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { GetUserParams } from "@workspace/api-zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();

router.get("/users/:userId", requireAuth, async (req, res) => {
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
