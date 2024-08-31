// Updated folderController.js
const folderService = require("../services/folderService");

// Create a folder (arcana) with automatic name assignment
exports.createFolder = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");

  if (!userEmail) {
    return res.status(400).json({ message: "Email header is missing" });
  }

  try {
    const folder = await folderService.createFolder(userEmail);
    res.status(201).json(folder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a folder by user email and folder name passed from the frontend
exports.getFolder = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");
  const folderName = req.query.folderName;

  if (!userEmail || !folderName) {
    return res.status(400).json({ message: "Email or folder name is missing" });
  }

  try {
    const folder = await folderService.getFolder(userEmail, folderName);
    res.status(200).json(folder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a folder by user email and folder name passed from the frontend
exports.deleteFolder = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");
  const folderName = req.query.folderName;

  if (!userEmail || !folderName) {
    return res.status(400).json({ message: "Email or folder name is missing" });
  }

  try {
    const result = await folderService.deleteFolder(userEmail, folderName);
    res.status(200).json({ success: result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
