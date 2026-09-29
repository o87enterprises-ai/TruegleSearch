/**
 * The request log carries nothing about a person: no IP, no query string, no
 * referrer, no user agent. A real Express app and a real HTTP request.
 */
const express = require('express');
const http = require('http');
const { requestLogger } = require('../middleware/requestLog');

function serve(handler) {
  const lines = [];
  const app = express();
  app.use(requestLogger({ write: (l) => lines.push(l) }));
  app.get('/api/media/search', (req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, () => resolve({ server, lines, port: server.address().port })));
}
const get = (port, path, headers) => new Promise((resolve, reject) => {
  http.get({ port, path, headers }, (res) => { res.resume(); res.on('end', resolve); }).on('error', reject);
});

describe('request log', () => {
  it('records method, path, status and timing — and nothing that identifies a search or a person', async () => {
    const { server, lines, port } = await serve();
    await get(port, '/api/media/search?q=dan%40example.com&u=https%3A%2F%2Fprivate.example%2Fx', {
      'X-Forwarded-For': '203.0.113.77',
      Referer: 'https://truegle.info/tube?q=secretreferrer',
      'User-Agent': 'SecretAgent/9.9',
    });
    await new Promise((r) => setTimeout(r, 50));
    server.close();
    const line = lines.join('');
    expect(line).toMatch(/GET \/api\/media\/search 200/);
    expect(line).not.toMatch(/dan|example|private/i);        // the query string
    expect(line).not.toMatch(/203\.0\.113|127\.0\.0\.1|::1/); // any IP
    expect(line).not.toMatch(/secretreferrer|SecretAgent/);   // referrer, user agent
    expect(line).not.toMatch(/\?/);                           // no query string at all
  });
});
