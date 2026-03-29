// Import the pre-compiled Express app (built with esbuild-plugin-pino for correct worker thread handling)
let _app: any = null;
let _appError: string | null = null;
let _appLoaded = false;

async function ensureApp() {
  if (_appLoaded) return _app;
  try {
    // Import the pre-built bundle — compiled with esbuild-plugin-pino to handle pino worker threads
    const mod = await import("../artifacts/api-server/dist/app.mjs");
    _app = mod.default;
  } catch (err: any) {
    _appError = String(err?.stack || err?.message || err);
    console.error("[Ready2Go] App load failed:", _appError);
  }
  _appLoaded = true;
  return _app;
}

// Start loading eagerly on cold start
const _loadPromise = ensureApp();

export default async function handler(req: any, res: any) {
  await _loadPromise;

  if (!_app) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "App initialization failed",
      detail: _appError,
      node: process.version,
    }));
    return;
  }

  _app(req, res);
}
