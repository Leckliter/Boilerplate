#!/usr/bin/env node
/**
 * A tiny in-memory S3 stand-in for development and tests (docs/files.md). It speaks just enough
 * of the S3 REST API (path-style) for this app's file module: presigned PUT from the browser,
 * GET (private files, with `response-content-disposition` for downloads), HEAD (size and type
 * check), DELETE, and CORS for the browser's cross-origin PUT. It does NOT check signatures or
 * expiry — it is for localhost only. Objects live in memory and vanish when it stops.
 *
 *   node scripts/dev-s3.mjs                      # listens on http://localhost:9000
 *   S3_STUB_PORT=9100 node scripts/dev-s3.mjs
 *
 * Point the app at it (.env.local):
 *   S3_ENDPOINT=http://localhost:9000  S3_BUCKET=dev  S3_ACCESS_KEY_ID=dev  S3_SECRET_ACCESS_KEY=dev
 *
 * Also importable: `import { startDevS3 } from './dev-s3.mjs'; const s3 = await startDevS3({ port: 0 });`
 * (`s3.url`, `s3.objects`, `s3.close()`), which is how scripts and tests can run it in process.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, PUT, HEAD, DELETE, OPTIONS',
  'access-control-allow-headers': '*',
  'access-control-expose-headers': 'ETag, Content-Length, Content-Type',
  'access-control-max-age': '600',
};

/** Starts the stub. `port: 0` picks a free port. Resolves to `{ url, port, objects, close }`. */
export function startDevS3({ port = 9000, host = '127.0.0.1' } = {}) {
  /** key (`bucket/path`) → { body: Buffer, type: string } */
  const objects = new Map();

  const server = createServer(async (req, res) => {
    const send = (status, headers = {}, body) => {
      res.writeHead(status, { ...CORS, ...headers });
      res.end(body);
    };
    try {
      const url = new URL(req.url ?? '/', 'http://stub');
      if (url.pathname === '/__health') return send(200, { 'content-type': 'text/plain' }, 'ok');
      if (req.method === 'OPTIONS') return send(204);
      // Path-style: /<bucket>/<key…>. The first segment is the bucket and stays part of the key.
      const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
      if (!key.includes('/')) {
        // Bucket-level request (list, location …): an empty, valid answer.
        return send(
          200,
          { 'content-type': 'application/xml' },
          '<?xml version="1.0"?><ListBucketResult/>',
        );
      }

      if (req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        let body = Buffer.concat(chunks);
        // aws-chunked uploads (SDK streaming) wrap the bytes in size-prefixed chunks; unwrap them.
        if (String(req.headers['content-encoding'] ?? '').includes('aws-chunked'))
          body = unchunk(body);
        const type = String(req.headers['content-type'] ?? 'application/octet-stream');
        objects.set(key, { body, type });
        return send(200, { etag: `"${body.length.toString(16)}"` });
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const found = objects.get(key);
        if (!found) {
          return send(
            404,
            { 'content-type': 'application/xml' },
            '<?xml version="1.0"?><Error><Code>NoSuchKey</Code><Message>Not found</Message></Error>',
          );
        }
        const headers = {
          'content-type': found.type,
          'content-length': String(found.body.length),
          etag: `"${found.body.length.toString(16)}"`,
        };
        const disposition = url.searchParams.get('response-content-disposition');
        if (disposition) headers['content-disposition'] = disposition;
        return send(200, headers, req.method === 'HEAD' ? undefined : found.body);
      }

      if (req.method === 'DELETE') {
        objects.delete(key); // S3 answers 204 whether or not it existed
        return send(204);
      }
      return send(405, { 'content-type': 'text/plain' }, 'Method not allowed');
    } catch (err) {
      console.error('[dev-s3]', err);
      return send(500, { 'content-type': 'text/plain' }, 'dev-s3 error');
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const actual = server.address().port;
      resolve({
        url: `http://localhost:${actual}`,
        port: actual,
        objects,
        close: () =>
          new Promise((done) => (server.closeAllConnections(), server.close(() => done()))),
      });
    });
  });
}

/** Removes `aws-chunked` framing: `<hex size>;chunk-signature=…\r\n<bytes>\r\n … 0;…\r\n\r\n`. */
function unchunk(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const eol = buf.indexOf('\r\n', i);
    if (eol < 0) break;
    const size = parseInt(buf.subarray(i, eol).toString('latin1').split(';')[0], 16);
    if (!Number.isFinite(size) || size === 0) break;
    out.push(buf.subarray(eol + 2, eol + 2 + size));
    i = eol + 2 + size + 2;
  }
  return Buffer.concat(out);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const port = Number(process.env.S3_STUB_PORT ?? 9000);
  startDevS3({ port }).then((s3) => {
    console.log(`dev-s3 listening on ${s3.url} (in memory; S3_ENDPOINT=${s3.url})`);
    for (const sig of ['SIGINT', 'SIGTERM'])
      process.on(sig, () => void s3.close().then(() => process.exit(0)));
  });
}
