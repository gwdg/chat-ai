// fileController.js
const fileService = require("../services/fileService");

// Upload a file to a specific folder
exports.uploadFile = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");
  const { folderName, fileName } = req.body; // Extracting from form-data fields
  const file = req.file; // Multer stores the uploaded file in req.file

  if (!userEmail || !folderName || !fileName || !file) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  try {
    const response = await fileService.uploadFile(
      userEmail,
      folderName,
      fileName,
      file
    );
    res.status(201).json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a file from a specific folder
exports.deleteFile = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");
  const { folderName, fileName } = req.body;

  if (!userEmail || !folderName || !fileName) {
    return res.status(400).json({ message: "Required fields are missing" });
  }

  try {
    const result = await fileService.deleteFile(
      userEmail,
      folderName,
      fileName
    );
    res.status(200).json({ success: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
