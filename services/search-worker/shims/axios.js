// Minimal fetch-based stand-in for the slice of axios the open-search adapters use:
// get(url, { params, headers, timeout }) and post(url, data, { headers, timeout }) -> { data, status },
// throwing an error with .response.status on non-2xx and .code === 'ECONNABORTED' on timeout (as axios does).
function withParams(url, params) {
  if (!params) return url;
  const u = new URL(url);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    u.searchParams.append(k, String(v));
  }
  return u.toString();
}

async function request(method, url, { headers, data, timeout = 5000 } = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: data === undefined ? undefined : (typeof data === 'string' ? data : JSON.stringify(data)),
      signal: AbortSignal.timeout(timeout),
      redirect: 'follow',
    });
  } catch (cause) {
    const err = new Error(cause && cause.name === 'TimeoutError' ? `timeout of ${timeout}ms exceeded` : (cause && cause.message) || 'network error');
    err.code = cause && cause.name === 'TimeoutError' ? 'ECONNABORTED' : 'ERR_NETWORK';
    throw err;
  }
  const text = await res.text();
  let parsed = text;
  try { parsed = JSON.parse(text); } catch { /* leave as text */ }
  if (!res.ok) {
    const err = new Error(`Request failed with status code ${res.status}`);
    err.response = { status: res.status, data: parsed };
    throw err;
  }
  return { data: parsed, status: res.status, headers: Object.fromEntries(res.headers) };
}

module.exports = {
  get: (url, cfg = {}) => request('GET', withParams(url, cfg.params), cfg),
  post: (url, data, cfg = {}) => request('POST', withParams(url, cfg.params), { ...cfg, data }),
};
