const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const folderController = require("../controllers/folderController");
const fileController = require("../controllers/fileController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(), // Store file in memory temporarily
  limits: { fileSize: 10 * 1024 * 1024 }, // Limit file size to 10MB
});

// Existing routes for user operations
router.get("/info", authMiddleware, userController.getUser);
router.post("/users", authMiddleware, userController.createUser);
router.put("/users/:email", authMiddleware, userController.updateUser);
router.delete("/users/:email", authMiddleware, userController.deleteUser);

// Routes for folder (arcana) management
router.post("/create", authMiddleware, folderController.createFolder);
router.get("/get", authMiddleware, folderController.getFolder);
router.delete("/delete", authMiddleware, folderController.deleteFolder);

// Routes for file operations
router.post(
  "/uploadfile",
  authMiddleware,
  upload.single("file"),
  fileController.uploadFile
);
router.delete("/deletefile", authMiddleware, fileController.deleteFile);

module.exports = router;
