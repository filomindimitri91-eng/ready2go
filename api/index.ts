import type { IncomingMessage, ServerResponse } from "http";

// Lazy-load the Express app to catch any init errors as a 503 (not FUNCTION_INVOCATION_FAILED).
let _app: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let _initError: string | null = null;
let _initialized = false;

const _ready = (async () => {
  try {
    const mod = await import("../artifacts/api-server/src/app");
    _app = mod.default as any;
  } catch (err: any) {
    _initError = String(err?.stack ?? err?.message ?? err);
    console.error("[ready2go] Module init failed:", _initError);
  }
  _initialized = true;
})();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!_initialized) await _ready;

  if (!_app) {
    res.writeHead(503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      error: "API init failed",
      detail: _initError,
      node: process.version,
      env: process.env.NODE_ENV,
    }));
    return;
  }

  _app(req, res);
}
