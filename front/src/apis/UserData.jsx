export const getUserData = async () => {
  try {
    const response = await fetch("/user");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};
