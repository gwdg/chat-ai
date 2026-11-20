// Fetches authenticated user's profile data from the server
import { authHeaders } from "./authHeaders";

// The profile is read by the page and by the brand resolver. Share one request
// per page load, but never cache a failure: a direct engine may gain the route
// after a reload.
let cachedUserData = null;

export const getUserDataCached = async () => {
  if (cachedUserData) return cachedUserData;
  const data = await getUserData();
  cachedUserData = data;
  return data;
};

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
