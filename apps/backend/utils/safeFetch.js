/**
 * Fetch a page from the open web for a stranger — without becoming a way in
 * to anything that is not the open web.
 *
 * Embed discovery (services/EmbedDiscovery.js) has to read ANY page somebody
 * pastes, which is the shape of an SSRF gadget: "server, go and fetch
 * http://169.254.169.254/…". The defence is at the socket, not the string:
 *   - http(s) only, default ports only
 *   - every hostname is resolved and EVERY address it resolves to must be a
 *     public one — loopback, private, link-local (cloud metadata), CGNAT,
 *     unique-local, multicast and reserved ranges are refused
 *   - the check runs inside the connection's own DNS lookup, so the address
 *     that was checked is the address that is connected to (no rebinding gap)
 *   - redirects are followed by hand, a few at most, each one re-checked
 *   - a hard timeout and a size cap, so a slow or huge page cannot hold us
 */
const http = require('node:http');
const https = require('node:https');
const dns = require('node:dns');
const net = require('node:net');

const blocked = new net.BlockList();
for (const [addr, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) blocked.addSubnet(addr, bits, 'ipv4');
for (const [addr, bits] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8], ['2001:db8::', 32], ['64:ff9b::', 96],
]) blocked.addSubnet(addr, bits, 'ipv6');

function isPublicAddress(address) {
  const family = net.isIP(address);
  if (!family) return false;
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) is judged as the IPv4 it carries.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return !blocked.check(mapped[1], 'ipv4');
  return !blocked.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

class FetchRefused extends Error {
  constructor(message) { super(message); this.name = 'FetchRefused'; }
}

// dns.lookup with every answer vetted. Used AS the socket's lookup.
function guardedLookup(hostname, options, callback) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err);
    const list = Array.isArray(addresses) ? addresses : [{ address: addresses, family: options.family }];
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new FetchRefused(`${hostname} is not on the public internet`));
    }
    if (options.all) return callback(null, list);
    return callback(null, list[0].address, list[0].family);
  });
}

function checkUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new FetchRefused('not a link'); }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new FetchRefused('only http(s)');
  if (u.port && u.port !== '80' && u.port !== '443') throw new FetchRefused('only the standard ports');
  if (u.username || u.password) throw new FetchRefused('no credentials in links');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && !isPublicAddress(host)) throw new FetchRefused('not a public address');
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new FetchRefused('not a public host');
  return u;
}

function once(u, { timeoutMs, maxBytes, accept }) {
  return new Promise((resolve, reject) => {
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(u, {
      method: 'GET',
      lookup: guardedLookup,
      timeout: timeoutMs,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Truegle/1.0; +https://truegle.info)',
        Accept: accept,
        'Accept-Language': 'en',
      },
    }, (res) => {
      const { statusCode, headers } = res;
      if (statusCode >= 300 && statusCode < 400 && headers.location) {
        res.resume();
        return resolve({ redirect: new URL(headers.location, u).toString() });
      }
      if (statusCode < 200 || statusCode >= 300) {
        res.resume();
        return reject(new Error(`HTTP ${statusCode}`));
      }
      // A media file is not read — knowing it IS one is the whole answer.
      if (/^(video|audio)\//i.test(headers['content-type'] || '')) {
        res.destroy();
        return resolve({ body: '', type: headers['content-type'], headers });
      }
      const chunks = []; let size = 0;
      res.on('data', (c) => {
        size += c.length;
        if (size > maxBytes) { res.destroy(); resolve({ body: Buffer.concat(chunks).toString('utf8'), type: headers['content-type'] || '', headers, truncated: true }); return; }
        chunks.push(c);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), type: headers['content-type'] || '', headers }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end();
  });
}

/**
 * @returns {Promise<{ url: string, body: string, type: string, headers: object }>}
 * @throws FetchRefused for anything that is not a public http(s) page
 */
async function safeFetch(raw, { timeoutMs = 6000, maxBytes = 1024 * 1024, maxRedirects = 4, accept = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5' } = {}) {
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const u = checkUrl(current);
    const res = await once(u, { timeoutMs, maxBytes, accept });
    if (res.redirect) { current = res.redirect; continue; }
    return { url: u.toString(), body: res.body, type: res.type, headers: res.headers || {} };
  }
  throw new Error('too many redirects');
}

module.exports = { safeFetch, isPublicAddress, checkUrl, FetchRefused };
