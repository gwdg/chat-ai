const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors"); // Import cors

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Use CORS middleware
app.use(
  cors({
    origin: "http://localhost:7220", // Allow requests from your frontend
    methods: ["GET", "POST"], // Specify the allowed methods
    allowedHeaders: ["Content-Type", "email"], // Specify the allowed headers
  })
);

// Middleware to parse JSON bodies
app.use(express.json());

// Import routes
const apiRoutes = require("./routes/apiRoutes");
app.use("/arcana", apiRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
