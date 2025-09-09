import type { IncomingMessage, ServerResponse } from 'http';
import app from "../server/app";

export default function handler(req: IncomingMessage & { url?: string }, res: ServerResponse) {
  // log incoming request for debugging
  try {
    // @ts-ignore
    console.log(`[api handler] ${req.method} ${req.url} headers=${JSON.stringify((req as any).headers || {})}`);
  } catch {}

  // Ensure our Express app sees the original /api prefix for routing
  try {
    const originalUrl = req.url || '/';
    console.log('[api handler] originalUrl=', originalUrl);
    if (!originalUrl.startsWith('/api')) {
      // make sure we preserve leading slash
      req.url = `/api${originalUrl.startsWith('/') ? originalUrl : '/' + originalUrl}`;
    } else {
      req.url = originalUrl;
    }
    console.log('[api handler] forwarded to app as url=', req.url);
  } catch (e) {
    // ignore logging errors
  }

  // @ts-ignore Express app is a request handler
  return app(req as any, res as any);
}
