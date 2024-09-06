// ArcanaApis.jsx
export const fetchArcanaInfo = async () => {
  try {
    const response = await fetch("/arcana/info", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data; // Ensure it returns the full user response with folders
  } catch (error) {
    console.error("Error fetching arcana info:", error);
    throw error;
  }
};

// Create a new folder (arcana)
export const createArcana = async () => {
  try {
    const response = await fetch("/arcana/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error creating arcana folder:", error);
    throw error;
  }
};

// Fetch a specific arcana folder by name
export const getArcana = async (folderName) => {
  try {
    const response = await fetch(`/arcana/get?folderName=${folderName}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching arcana folder:", error);
    throw error;
  }
};

// Delete a specific arcana folder by name
export const deleteArcana = async (folderName) => {
  try {
    const response = await fetch(`/arcana/delete?folderName=${folderName}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error deleting arcana folder:", error);
    throw error;
  }
};

// Function to upload a file to a specific folder
export const uploadFile = async (file, folderName, fileName) => {
  try {
    const formData = new FormData();
    formData.append("file", file); // File input
    formData.append("folderName", folderName); // Folder name
    formData.append("fileName", fileName); // File name

    const response = await fetch("/arcana/uploadfile", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error uploading file:", error);
    throw error;
  }
};

// Function to delete a file from a specific folder
export const deleteFile = async (folderName, fileName) => {
  try {
    const response = await fetch(`/arcana/deletefile`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        folderName: folderName,
        fileName: fileName,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error Response:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error("Error deleting file:", error);
    throw error;
  }
};

// ArcanaApis.jsx
export const buildArcana = async (folderName) => {
  const response = await fetch("/arcana/build", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Email will be automatically handled by the backend from headers
    },
    body: JSON.stringify({
      folderName: folderName, // Only sending folder name
    }),
  });

  // Handle response status directly
  if (!response.ok) {
    if (response.status === 400) {
      const errorData = await response.json();
      if (errorData.detail === "Indexing already in progress") {
        throw new Error("Indexing already in progress");
      }
    }
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data.success;
};
