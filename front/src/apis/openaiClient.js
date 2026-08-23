import OpenAI from "openai";

// Resolve the backend endpoint from config
function resolveBaseURL() {
  const endpoint = import.meta.env.VITE_BACKEND_ENDPOINT;
  try {
    // If absolute, parse directly
    return new URL(endpoint).toString();
  } catch {
    // If relative, resolve against current origin
    return new URL(endpoint, window.location.origin).toString();
  }
}

// Define openai object to call backend.
// The backend authenticates the user through the OIDC proxy, so no API key is
// involved. The placeholder key only satisfies the SDK constructor, which since
// openai v6 rejects a null key; the Authorization header is explicitly omitted
// so that no key-like value is ever sent.
export function createBackendClient(timeout = 20000) {
  return new OpenAI({
    baseURL: resolveBaseURL(),
    apiKey: "not-needed",
    defaultHeaders: { Authorization: null },
    dangerouslyAllowBrowser: true,
    timeout: timeout,
  });
}
