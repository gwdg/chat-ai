// fileService.js
const axios = require("axios");
const FormData = require("form-data"); // To handle form-data for file uploads

// Upload a file to the actual backend
exports.uploadFile = async (userEmail, folderName, fileName, file) => {
  try {
    const formData = new FormData();
    formData.append("file", file.buffer, file.originalname); // Assuming `file` contains buffer and metadata
    formData.append("user_email", userEmail);
    formData.append("folder_name", folderName);
    formData.append("name", fileName);

    const response = await axios.post(
      `${process.env.API_BASE_URL}/files`,
      formData,
      {
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      console.error("Error Response Data:", error.response.data);
    } else {
      console.error("Error Message:", error.message);
    }
    throw new Error("Failed to upload file");
  }
};

// Delete a file from the actual backend
exports.deleteFile = async (userEmail, folderName, fileName) => {
  try {
    const response = await axios.delete(
      `${process.env.API_BASE_URL}/files/${userEmail}/${folderName}/${fileName}`,
      {
        data: {
          user_email: userEmail,
          folder_name: folderName,
          name: fileName,
        },
      }
    );

    return response.data === true;
  } catch (error) {
    if (error.response) {
      console.error("Error Response Data:", error.response.data);
    } else {
      console.error("Error Message:", error.message);
    }
    throw new Error("Failed to delete file");
  }
};
