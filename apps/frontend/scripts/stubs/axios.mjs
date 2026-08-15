// Axios, replaced at bundle time for the map verifier.
//
// The map APIs are unreachable from this sandbox — the environment's network
// policy denies api.mapbox.com, api.tomtom.com, nominatim and OSRM — so the
// provider ladder is exercised against recorded response shapes instead. The
// test installs its handler on globalThis before importing the service.
const dispatch = (call) => {
  const h = globalThis.__mapTestAxios;
  if (!h) throw new Error('map test: no stub handler installed');
  return h(call);
};

const axios = {
  get: (url, config) => Promise.resolve().then(() => dispatch({ method: 'get', url, params: config?.params, headers: config?.headers })),
  post: (url, body) => Promise.resolve().then(() => dispatch({ method: 'post', url, body })),
};

export default axios;
