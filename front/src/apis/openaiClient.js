// Client for the backend's OpenAI-compatible API.
//
// By default requests go through a small fetch-based client (fetchClient.js)
// that mirrors the parts of the openai SDK this app uses. Setting
// `"useOpenAISdk": true` in front.json switches back to the official SDK, which
// is then loaded on demand so it never weighs on the default bundle.
import { createFetchClient } from "./fetchClient";

// Resolve the backend endpoint from config
export function resolveBaseURL() {
  const endpoint = import.meta.env.VITE_BACKEND_ENDPOINT;
  try {
    // If absolute, parse directly
    return new URL(endpoint).toString();
  } catch {
    // If relative, resolve against current origin
    return new URL(endpoint, window.location.origin).toString();
  }
}

const useOpenAISdk = () => import.meta.env.VITE_USE_OPENAI_SDK === "true";

// The backend authenticates the user through the OIDC proxy, so no API key is
// involved. The SDK constructor needs a placeholder key (openai v6 rejects a
// null one); its Authorization header is explicitly omitted so that no
// key-like value is ever sent.
let sdkPromise;
const createSdkClient = (timeout) => {
  if (!sdkPromise) {
    sdkPromise = import("openai").catch((err) => {
      sdkPromise = undefined;
      throw err;
    });
  }
  const client = sdkPromise.then(
    ({ default: OpenAI }) =>
      new OpenAI({
        baseURL: resolveBaseURL(),
        apiKey: "not-needed",
        defaultHeaders: { Authorization: null },
        dangerouslyAllowBrowser: true,
        timeout,
      })
  );
  return {
    chat: {
      completions: {
        create: async (params, options) =>
          (await client).chat.completions.create(params, options),
      },
    },
  };
};

export function createBackendClient(timeout = 20000) {
  return useOpenAISdk()
    ? createSdkClient(timeout)
    : createFetchClient({ baseURL: resolveBaseURL(), timeout });
}
