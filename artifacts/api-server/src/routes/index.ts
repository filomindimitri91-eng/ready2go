import { Router } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tripsRouter from "./trips";
import aiRouter from "./ai";
import authRouter from "./auth";

const router = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(tripsRouter);
router.use(aiRouter);

export default router;
