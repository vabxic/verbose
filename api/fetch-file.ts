// Simple server-side proxy to fetch files and return them with CORS headers.
// Intended for deployment on Vercel / serverless hosts under `/api/fetch-file`.
// Usage: GET /api/fetch-file?url=<encoded-url>

export default async function handler(req: any, res: any) {
  const url = (req.query?.url || (req.url && req.url.split('?url=')[1])) || null;
  if (!url) {
    res.statusCode = 400;
    res.end('Missing url parameter');
    return;
  }

  // Basic host whitelist to avoid open proxy abuse. Extend as needed.
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const allowedHosts = [
      'drive.google.com',
      'www.googleapis.com',
      'docs.google.com',
      'storage.googleapis.com',
    ];
    if (!allowedHosts.includes(host)) {
      res.statusCode = 403;
      res.end('Host not allowed');
      return;
    }
  } catch (err) {
    res.statusCode = 400;
    res.end('Invalid url');
    return;
  }

  try {
    const upstream = await fetch(url);
    const body = await upstream.arrayBuffer();

    // Forward key headers
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const contentLength = upstream.headers.get('content-length');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    res.statusCode = upstream.status;
    res.end(Buffer.from(body));
  } catch (err: any) {
    res.statusCode = 502;
    res.end(String(err?.message || err || 'Failed to fetch upstream'));
  }
}
