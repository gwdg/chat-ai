// useUpdateUserData.js
import { useState, useEffect, useRef } from "react";
import { getVideoList } from "../apis/videoListApi";

const POLL_INTERVAL_MS = 10_000; // 10 seconds

export function useUpdateVideoList() {
  const [videoList, setVideoList] = useState(null);

  // Keeps track of whether a fetch is currently running
  const isFetchingRef = useRef(false);

  // Interval id ref so we can clean it up
  const intervalRef = useRef(null);

  const fetchVideoList = async () => {
    // Prevent overlapping requests
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    try {
      const data = await getVideoList();
      setVideoList(data);
    } catch (error) {
      console.error("Failed to fetch video list:", error);
    } finally {
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    // Initial fetch on mount
    fetchVideoList();

    // Poll every 10 seconds
    intervalRef.current = setInterval(fetchVideoList, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return videoList;
}