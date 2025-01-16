// Fetches authenticated user's profile data from the server
export const fetchCurrentUserProfile = async () => {
  try {
    const response = await fetch("/user");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const userData = await response.json();
    return userData;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};
