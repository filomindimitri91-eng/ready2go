import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import tripsRouter from "./trips";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(tripsRouter);
router.use(aiRouter);

export default router;
