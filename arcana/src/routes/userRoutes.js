const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const folderController = require("../controllers/folderController");
const authMiddleware = require("../middlewares/authMiddleware");

// Existing routes for user operations
router.get("/info", authMiddleware, userController.getUser);
router.post("/users", authMiddleware, userController.createUser);
router.put("/users/:email", authMiddleware, userController.updateUser);
router.delete("/users/:email", authMiddleware, userController.deleteUser);

// New routes for folder (arcana) management
router.post("/create", authMiddleware, folderController.createFolder);
router.get("/get", authMiddleware, folderController.getFolder);
router.delete("/delete", authMiddleware, folderController.deleteFolder);

module.exports = router;
