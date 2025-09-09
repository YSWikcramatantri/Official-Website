import type { IncomingMessage, ServerResponse } from 'http';
import app from "../server/app";

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // log incoming request for debugging
  try {
    // @ts-ignore
    console.log(`[api handler] ${req.method} ${req.url} headers=${JSON.stringify((req as any).headers || {})}`);
  } catch {}

  // Ensure our Express app sees the original /api prefix for routing
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  // @ts-ignore Express app is a request handler
  return app(req, res);
}
