
const express = require("express");
const router = express.Router();

const {
  getMenuAvailability,
} = require("../controllers/availabilityController");

router.get("/", getMenuAvailability);

module.exports = router;
