import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { apiRateLimiter } from "./middleware/rateLimit";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGIN
  ? [process.env.ALLOWED_ORIGIN]
  : ["http://localhost:21626", "http://localhost:5173"];

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed =
        ALLOWED_ORIGINS.includes(origin) ||
        /\.replit\.dev$/.test(origin) ||
        /\.janeway\.replit\.dev$/.test(origin) ||
        (process.env.NODE_ENV !== "production");
      cb(null, allowed);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: false,
  }),
);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use("/api", (_req, res, next) => {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    res.status(503).json({ error: "Base de données non configurée. Ajoutez Vercel Postgres dans Storage → Connect to Project." });
    return;
  }
  next();
});

app.use("/api", apiRateLimiter);
app.use("/api", router);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err.message === "DATABASE_URL_MISSING") {
    res.status(503).json({ error: "Base de données non configurée. Ajoutez DATABASE_URL dans les variables d'environnement Vercel." });
    return;
  }
  res.status(500).json({ error: "Erreur serveur" });
});

export default app;
