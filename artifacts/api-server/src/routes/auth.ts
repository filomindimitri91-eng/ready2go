import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { authRateLimiter } from "../middleware/rateLimit";
import * as gdb from "../github-db";

const router: IRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-production";
const JWT_EXPIRES_IN = "30d";

const RegisterBody = z.object({
  username: z
    .string()
    .min(2, "Le pseudo doit contenir au moins 2 caractères.")
    .max(30, "Le pseudo ne peut pas dépasser 30 caractères.")
    .regex(/^[a-zA-Z0-9_\-À-ÿ]+$/, "Pseudo invalide (lettres, chiffres, _ et - uniquement)."),
  password: z
    .string()
    .min(6, "Le mot de passe doit contenir au moins 6 caractères.")
    .max(100),
});

const LoginBody = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

function signToken(userId: number, username: string) {
  return jwt.sign({ sub: userId, username }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

router.post("/auth/register", authRateLimiter, async (req, res) => {
  try {
    const body = RegisterBody.parse(req.body);
    const existing = await gdb.getUserByUsername(body.username);

    if (existing?.passwordHash) {
      res.status(409).json({ error: "Ce nom d'utilisateur est déjà pris." });
      return;
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    let user: gdb.User;

    if (existing) {
      user = (await gdb.updateUser(existing.id, { passwordHash })) ?? existing;
    } else {
      user = await gdb.createUser({ username: body.username, passwordHash });
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

router.post("/auth/login", authRateLimiter, async (req, res) => {
  try {
    const body = LoginBody.parse(req.body);
    const user = await gdb.getUserByUsername(body.username);

    if (!user?.passwordHash) {
      await bcrypt.hash("dummy", 12);
      res.status(401).json({ error: "Identifiants incorrects." });
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

export default router;
