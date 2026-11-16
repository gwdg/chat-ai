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

// Fake identity headers for a direct endpoint whose routes normally sit behind
// an OIDC proxy. `"fakeAuthHeaders"` in front.json is passed through verbatim,
// so a local SAIA engine's /assumes_behind_oidc app sees the same oidc_claim_*
// headers Apache/auth_openidc adds in a deployment. It is empty by default.
//
// This lets the browser impersonate that user. Only use it against a test
// endpoint whose protected routes are not reachable from anywhere else, and
// never set it in a production front.json.
export function getFakeAuthHeaders() {
  const raw = import.meta.env.VITE_FAKE_AUTH_HEADERS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([name, value]) => name && typeof value === "string"
      )
    );
  } catch {
    return {};
  }
}

export function authHeaders() {
  const headers = { ...getFakeAuthHeaders() };
  const apiKey = getApiKey();
  // A configured apiKey wins over a fake Authorization header.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}
