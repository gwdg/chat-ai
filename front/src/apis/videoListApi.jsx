// Fetches user's videos in queue
export const getVideoList = async () => {
  try {
    const response = await fetch("/v1/queue/listpending/video");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const listData = await response.json();
    return listData;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};

// Deletes video from queue
export const deleteVideo = async (id) => {
  try {
    const response = await fetch(`/v1/queue/delete/video/${id}`, {method: 'POST'});
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};

// Deletes video from queue
export const downloadVideo = async (id) => {
  try {
    const response = await fetch(`/v1/queue/download/video/${id}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    throw new Error(`Failed to fetch user data: ${error.message}`);
  }
};
