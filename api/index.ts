let appPromise: Promise<any>;

async function loadApp() {
  try {
    const mod = await import("../artifacts/api-server/src/app");
    return mod.default;
  } catch (err: any) {
    console.error("[api/index] Failed to load app:", err?.message, err?.stack);
    return null;
  }
}

appPromise = loadApp();

export default async function handler(req: any, res: any) {
  try {
    const app = await appPromise;
    if (!app) {
      res.status(503).json({
        error: "App failed to initialize",
        detail: "Check Vercel function logs for the startup error",
      });
      return;
    }
    app(req, res);
  } catch (err: any) {
    console.error("[api/index] Handler error:", err?.message);
    res.status(500).json({ error: "Internal server error", detail: err?.message });
  }
}
