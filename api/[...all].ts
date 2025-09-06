import type { IncomingMessage, ServerResponse } from 'http';
import app from "../server/app";

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // Ensure our Express app sees the original /api prefix for routing
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url}`;
  }
  // @ts-ignore Express app is a request handler
  return app(req, res);
}
