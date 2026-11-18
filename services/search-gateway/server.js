// Entry point of the Hugging Face Space. The pool + adapters + HTTP app are copied in by
// scripts/stage-search-gateway.sh from apps/backend/services/openSearch (single source of truth).
const { createApp } = require('./services/openSearch/gatewayServer');

const port = Number(process.env.PORT) || 7860;
createApp().listen(port, '0.0.0.0', () => {
  // Never log the token or any request content.
  console.log(`truegle search gateway listening on :${port} (${process.env.SEARCH_GATEWAY_TOKEN ? 'token set' : 'NO TOKEN: every search is refused with 503'})`);
});
