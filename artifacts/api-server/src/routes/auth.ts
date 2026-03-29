import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "30d";

const RegisterBody = z.object({
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_\-]+$/, "Lettres, chiffres, _ et - uniquement"),
  password: z.string().min(6).max(100),
});

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: number, username: string) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post("/auth/register", async (req, res) => {
  try {
    const body = RegisterBody.parse(req.body);

    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, body.username))
      .limit(1);

    if (existing.length > 0 && existing[0].passwordHash) {
      res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    let user;
    if (existing.length > 0) {
      [user] = await db
        .update(usersTable)
        .set({ passwordHash })
        .where(eq(usersTable.username, body.username))
        .returning();
    } else {
      [user] = await db
        .insert(usersTable)
        .values({ username: body.username, passwordHash })
        .returning();
    }

    const token = signToken(user.id, user.username);
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: err.errors[0]?.message || "Données invalides" });
      return;
    }
    req.log.error({ err }, "Error registering user");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const body = LoginBody.parse(req.body);

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, body.username))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    if (!user.passwordHash) {
      res.status(401).json({ error: "Ce compte n'a pas de mot de passe. Veuillez vous inscrire." });
      return;
    }

    const valid = await bcrypt.compare(body.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Identifiants incorrects." });
      return;
    }

    const token = signToken(user.id, user.username);
    res.json({ token, userId: user.id, username: user.username });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Données invalides" });
      return;
    }
    req.log.error({ err }, "Error logging in");
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export { JWT_SECRET };
export default router;
