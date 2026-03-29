import type { IncomingMessage, ServerResponse } from "http";

// Minimal Vercel function — no external dependencies
// This diagnoses if the issue is with bundling or with our code
export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ alive: true, node: process.version, env: process.env.NODE_ENV }));
}
