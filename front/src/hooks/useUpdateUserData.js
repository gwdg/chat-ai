// useUpdateUserData.js
import { useState, useEffect, useCallback } from "react";
import { getUserData } from "../apis/getUserData";

export function useUpdateUserData() {
  const [userData, setUserData] = useState(null);

  // TODO define default user

  // Fetch user profile data on component mount
  const updateUserData = useCallback(async () => {
    try {
      const data = await getUserData();
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