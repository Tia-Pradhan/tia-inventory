
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "My POS API is working!" });
});

app.listen(5000, () => {
  console.log("API running at http://localhost:5000");
});
