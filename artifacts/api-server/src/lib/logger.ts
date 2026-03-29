import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

// In production (Vercel/Lambda), pass process.stdout directly to bypass thread-stream
// worker threads, which can fail in serverless environments.
// In development, use pino-pretty for human-readable logs.
export const logger = isProduction
  ? pino(
      {
        level: process.env.LOG_LEVEL ?? "info",
        redact: [
          "req.headers.authorization",
          "req.headers.cookie",
          "res.headers['set-cookie']",
        ],
      },
      process.stdout,
    )
  : pino({
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "res.headers['set-cookie']",
      ],
      transport: {
        target: "pino-pretty",
        options: { colorize: true },
      },
    });
