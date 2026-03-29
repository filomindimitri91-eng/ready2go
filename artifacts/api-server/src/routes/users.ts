import { Router, type IRouter } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import * as gdb from "../github-db";

const router: IRouter = Router();

function parseParam(val: string | string[]): string {
  return Array.isArray(val) ? val[0] ?? "" : val;
}

router.get("/users/:userId", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(parseParam(req.params.userId));
    if (isNaN(userId)) {
      res.status(400).json({ error: "userId invalide" });
      return;
    }
    const user = await gdb.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable" });
      return;
    }
    const { passwordHash: _ph, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    req.log.error({ err }, "Error getting user");
    res.status(400).json({ error: "Requête invalide" });
  }
});

export default router;
