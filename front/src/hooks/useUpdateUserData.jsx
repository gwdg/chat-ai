// useUpdateUserData.js
import { useState, useEffect, useCallback } from "react";
import { getUserDataCached } from "../apis/getUserData";

export function useUpdateUserData() {
  const [userData, setUserData] = useState(null);

  // TODO define default user

  // Fetch user profile data on component mount. The request is shared with the
  // brand resolver, which reads the same profile.
  const updateUserData = useCallback(async () => {
    try {
      const data = await getUserDataCached();
      setUserData(data);
    } catch (error) {
      console.error("Failed to fetch user data:", error);
    }
  }, []);

  useEffect(() => {
    updateUserData();
  }, [updateUserData]);

  return userData;
}
