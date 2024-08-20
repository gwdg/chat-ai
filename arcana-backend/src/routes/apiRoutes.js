const express = require("express");
const router = express.Router();
const apiController = require("../controllers/apiController");

// Define your routes here
router.get("/arcana-info", apiController.getArcanaInfo);

module.exports = router;
