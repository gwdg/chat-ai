// Fetches authenticated user's profile data from the server
import { authHeaders } from "./authHeaders";

export const getUserData = async () => {
  const endpoint = import.meta.env.VITE_USERDATA_ENDPOINT;
  // Direct endpoints (a local SAIA engine) have no user/profile route; skip the
  // call instead of requesting an undefined URL. `userData` then stays null.
  if (!endpoint) return null;
  try {
    const response = await fetch(endpoint, { headers: authHeaders() });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const userData = await response.json();
    return userData;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};
