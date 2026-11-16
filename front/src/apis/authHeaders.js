// Optional API key for deployments where the browser calls an API directly
// instead of going through the OIDC-protected `back` proxy, for example a local
// SAIA engine. Set `"apiKey"` in front.json to enable it; without a key the
// helpers return nothing, so requests look exactly as they did before.
//
// The key is compiled into the bundle by Vite, so treat it as public: it only
// fits a non-production endpoint such as the local test stack.
export function getApiKey() {
  return import.meta.env.VITE_API_KEY || "";
}

export function authHeaders() {
  const apiKey = getApiKey();
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}
