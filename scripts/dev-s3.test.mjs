import assert from 'node:assert/strict';
import { test } from 'node:test';

import { startDevS3 } from './dev-s3.mjs';

test('stores, heads, reads, downloads and deletes objects, with CORS', async () => {
  const s3 = await startDevS3({ port: 0 });
  try {
    const u = `${s3.url}/bucket/private-files/a/b.txt`;
    assert.equal((await fetch(u, { method: 'HEAD' })).status, 404);

    const put = await fetch(`${u}?X-Amz-Signature=x`, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: 'hello',
    });
    assert.equal(put.status, 200);
    assert.equal(put.headers.get('access-control-allow-origin'), '*');

    const head = await fetch(u, { method: 'HEAD' });
    assert.equal(head.headers.get('content-length'), '5');
    assert.equal(head.headers.get('content-type'), 'text/plain');

    const get = await fetch(
      `${u}?response-content-disposition=${encodeURIComponent('attachment; filename="b.txt"')}`,
    );
    assert.equal(await get.text(), 'hello');
    assert.equal(get.headers.get('content-disposition'), 'attachment; filename="b.txt"');

    const preflight = await fetch(u, {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3100' },
    });
    assert.equal(preflight.status, 204);
    assert.match(preflight.headers.get('access-control-allow-methods') ?? '', /PUT/);

    assert.equal((await fetch(u, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(u, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(u, { method: 'HEAD' })).status, 404);
  } finally {
    await s3.close();
  }
});
