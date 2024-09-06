// Updated folderService.js
const axios = require("axios");

// Helper function to determine the next available folder name
const generateNextFolderName = (existingFolders) => {
  const defaultNames = ["Arcana 1", "Arcana 2", "Arcana 3"];
  for (const name of defaultNames) {
    if (!existingFolders.includes(name)) {
      return name;
    }
  }
  throw new Error("Maximum number of folders reached");
};

// Create a new folder with the next available name
exports.createFolder = async (userEmail) => {
  try {
    // Fetch existing folders to determine if a new one can be created
    const response = await axios.get(
      `${process.env.API_BASE_URL}/users/${userEmail}`
    );

    const existingFolders = response.data.folders.map((folder) => folder.name);

    // Generate the next available folder name
    const folderName = generateNextFolderName(existingFolders);

    // Attempt to create the new folder
    const createResponse = await axios.post(
      `${process.env.API_BASE_URL}/folders`,
      {
        user_email: userEmail,
        name: folderName,
      }
    );

    return createResponse.data;
  } catch (error) {
    // Log the error details for better debugging
    if (error.response) {
      // Server responded with a status code outside the range of 2xx
      console.error("Error Response Data:", error.response.data);
      console.error("Error Response Status:", error.response.status);
      console.error("Error Response Headers:", error.response.headers);
    } else if (error.request) {
      // Request was made but no response was received
      console.error("Error Request:", error.request);
    } else {
      // Something happened in setting up the request
      console.error("Error Message:", error.message);
    }

    // Throw a detailed error message to be caught by the controller
    throw new Error(`Failed to create folder: ${error.message}`);
  }
};

// Fetch a specific folder for the user
exports.getFolder = async (userEmail, folderName) => {
  try {
    const response = await axios.get(
      `${process.env.API_BASE_URL}/folders/${userEmail}/${folderName}`
    );
    return response.data;
  } catch (error) {
    throw new Error("Failed to fetch folder information");
  }
};

// Delete a specific folder for the user
exports.deleteFolder = async (userEmail, folderName) => {
  try {
    const response = await axios.delete(
      `${process.env.API_BASE_URL}/folders/${userEmail}/${folderName}`
    );
    return response.data === true;
  } catch (error) {
    throw new Error("Failed to delete folder");
  }
};

// Build a folder (indexing operation)
exports.buildFolder = async (userEmail, folderName) => {
  try {
    const response = await axios.post(
      `${process.env.API_BASE_URL}/api/build/${userEmail}/${folderName}`,
      {
        user_email: userEmail,
        folder_name: folderName,
      }
    );

    if (response.status === 200) {
      return true; // Successfully built
    } else if (response.status === 400) {
      return "in_progress"; // Indexing already in progress
    } else {
      throw new Error("Unexpected response status: " + response.status);
    }
  } catch (error) {
    if (error.response && error.response.status === 400) {
      return "in_progress";
    }
    console.error("Error during folder build:", error.message);
    throw new Error("Failed to build folder");
  }
};
