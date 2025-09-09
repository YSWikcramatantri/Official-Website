import type { IncomingMessage, ServerResponse } from 'http';
import app from "../../server/app";

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  try {
    console.log(`[api/admin/login handler] ${req.method} ${req.url}`);
  } catch {}

  // Ensure the express app receives the correct url
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }

  // @ts-ignore
  return app(req as any, res as any);
}
