const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // To handle form data

const userRoutes = require("./routes/userRoutes");

app.use("/arcana", userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
